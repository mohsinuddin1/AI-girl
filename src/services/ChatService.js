import { supabase } from '../lib/supabase';
import useStore from '../store/useStore';
import { FileUploadService } from './FileUploadService';

export const ChatService = {
    /**
     * Send a message to the AIGirl AI, including user memory and health preferences.
     * @param {string} message - The user's input message
     * @param {Array} history - Previous chat history
     * @returns {Promise<Object>} - The AI response
     */
    async sendMessage(message, history = []) {
        // STM: Keep only the last 15 messages for conversation continuity
        const slicedHistory = history.slice(-15);
        const state = useStore.getState();
        const { user, profile, selectedPersona, longTermFacts } = state;
        
        // Save user message
        await this.saveMessage('user', message);
        
        // Build the system memory payload
        const memoryPayload = {
            userName: profile?.name || user?.user_metadata?.full_name || 'Guest',
            persona: selectedPersona || null,
            userMemory: profile?.memory || '',
            longTermFacts: longTermFacts || profile?.long_term_facts || '',
        };

        try {
            if (!supabase) throw new Error('Supabase not initialized. Please check your connection.');
            const response = await supabase.functions.invoke('aigirl-chat2', {
                body: {
                    message,
                    history: slicedHistory,
                    memory: memoryPayload,
                },
            });
            // 429 and 500 errors come back as FunctionsHttpError with a context property (the Response object)
            if (response.error) {
                let errMsg = response.error.message || 'Chat failed';
                
                // If the error has a context (fetch Response), try to extract the real JSON error
                if (response.error.context && typeof response.error.context.json === 'function') {
                    try {
                        const errorBody = await response.error.context.json();
                        if (errorBody && errorBody.error) {
                            errMsg = errorBody.error;
                        }
                    } catch (e) {
                        // Ignore JSON parsing errors
                    }
                }

                if (errMsg.includes('RATE_LIMIT_EXCEEDED') || errMsg.includes('rate limit') || errMsg.includes('chat limit') || errMsg.includes('upgrade')) {
                    useStore.getState().setShowUpgradeModal(true);
                    throw new Error('RATE_LIMIT_EXCEEDED');
                }
                throw new Error(errMsg);
            }

            // Also check data just in case the backend returns 200 with an error object
            if (response.data?.error) {
                const errMsg = response.data.error;
                if (errMsg.includes('RATE_LIMIT_EXCEEDED') || errMsg.includes('rate limit') || errMsg.includes('chat limit') || errMsg.includes('upgrade')) {
                    useStore.getState().setShowUpgradeModal(true);
                    throw new Error('RATE_LIMIT_EXCEEDED');
                }
                throw new Error(errMsg);
            }

            if (response.data && response.data.text) {
                // Save AI response
                await this.saveMessage('assistant', response.data.text);
                
                const currentCount = useStore.getState().messageCountSinceCondense || 0;
                useStore.setState({ messageCountSinceCondense: currentCount + 1 });
            }
            
            return response.data;
        } catch (error) {
            console.error('Chat API error:', error);
            throw error;
        }
    },

    /**
     * Save structured JSON from a scanned medical report to the user's permanent AI memory.
     * @param {Object} reportData - The JSON memory object from medAnalyze1
     */
    async addReportToMemory(reportData) {
        const state = useStore.getState();
        const { user, profile } = state;
        
        if (!user) return; // Guest users without auth might only have local memory
        
        try {
            // Overwrite existing memory completely with the new upload
            const memoryArray = [{
                report_type: reportData.report_type || "document",
                summary: reportData.summary || "",
                key_findings: reportData.key_findings || [],
                conditions_discussed: reportData.conditions_discussed || [],
                recommended_followups: reportData.recommended_followups || [],
                timestamp: new Date().toISOString()
            }];
            
            const newMemoryJson = JSON.stringify(memoryArray);
            
            // Update Supabase
            const { data, error } = await supabase
                .from('aigirl_users')
                .update({ medical_memory: newMemoryJson })
                .eq('id', user.id)
                .select()
                .single();
                
            if (error) throw error;
            
            // Update local store
            useStore.setState({ profile: { ...profile, medical_memory: data.medical_memory } });
        } catch (error) {
            console.error('Failed to update AI Memory:', error);
        }
    },

    /**
     * Update the user's manual memory text.
     * @param {string} text - The memory text
     */
    async updateUserMemory(text) {
        const state = useStore.getState();
        const { user, profile } = state;
        
        if (!user) return false;
        
        try {
            const { error } = await supabase
                .from('aigirl_users')
                .update({ memory: text })
                .eq('id', user.id);
                
            if (error) throw error;
            
            // Update local store
            useStore.setState({ profile: { ...profile, memory: text } });
            return true;
        } catch (error) {
            console.error('Failed to update manual memory:', error);
            return false;
        }
    },

    /**
     * Quick client-side check: does the user have scans remaining?
     * Queries the `users` table (which always exists). This is a bandwidth-saving
     * pre-check — the server is still the authoritative gate.
     *
     * @returns {Promise<{allowed: boolean}>}
     */
    async checkScanLimitLocal() {
        try {
            const { user } = useStore.getState();
            if (!user || !supabase) return { allowed: true };

            // 1. Get the user's daily scans
            const { data: userData, error: userError } = await supabase
                .from('aigirl_users')
                .select('is_pro, daily_scans, last_scan_date')
                .eq('id', user.id)
                .single();

            if (userError || !userData) return { allowed: true };
            if (userData.is_pro) return { allowed: true }; 

            // 2. Get the real limit from app_settings instead of hardcoding 1
            const { data: appSettings } = await supabase
                .from('aigirl_app_settings')
                .select('free_daily_limit, free_scans_enabled')
                .limit(1)
                .single();
                
            const freeDailyLimit = appSettings?.free_daily_limit ?? 1;
            const freeEnabled = appSettings?.free_scans_enabled ?? true;

            if (!freeEnabled) return { allowed: false };

            const today = new Date().toISOString().split('T')[0];
            if (userData.last_scan_date === today && (userData.daily_scans || 0) >= freeDailyLimit) {
                return { allowed: false };
            }
            return { allowed: true };
        } catch (e) {
            console.warn('[ChatService] Limit pre-check failed, allowing:', e.message);
            return { allowed: true };
        }
    },

    /**
     * Uploads a document/image to Supabase Storage, analyzes it via medAnalyze1, and saves memory.
     * NEW: Checks rate limit FIRST (saves bandwidth), returns storagePath + signedUrl.
     *
     * @param {string} uri - Local file URI
     * @param {string} mimeType - MIME type of the file
     * @param {string} [fileName] - Original file name from picker
     * @returns {Promise<Object>} - { ...analysisData, storagePath, signedUrl }
     */
    async processScan(uri, mimeType, fileName) {
        const state = useStore.getState();
        const { user } = state;

        if (!supabase) throw new Error('Supabase not initialized');

        // ── Step 1: Pre-check rate limit BEFORE uploading (saves bandwidth) ──
        const { allowed } = await this.checkScanLimitLocal();
        if (!allowed) {
            useStore.getState().setShowUpgradeModal(true);
            throw new Error('RATE_LIMIT_EXCEEDED');
        }

        // ── Step 2: Upload to Supabase Storage ──
        let storagePath = null;
        let requestBody;

        try {
            const uploadResult = await FileUploadService.uploadFile(uri, mimeType, user?.id);
            storagePath = uploadResult.storagePath;
            requestBody = {
                storagePath,
                mimeType,
                fileName: fileName || 'Uploaded File',
            };
            console.log('[ChatService] File uploaded to Storage:', storagePath);
        } catch (uploadError) {
            console.error('[ChatService] Storage upload failed:', uploadError.message);
            throw new Error('Could not upload the file. Please check your connection and try again.');
        }

        // ── Step 3: Get a signed cloud URL (valid 10 days) ──
        let signedUrl = null;
        if (storagePath) {
            signedUrl = await FileUploadService.getSignedUrl(storagePath);
        }

        // ── Step 4: Call Edge Function ──
        try {
            const { data: analysisData, error: analysisError } = await supabase.functions.invoke('medAnalyze2', {
                body: requestBody,
            });

            const checkRateLimit = (msg) => {
                if (!msg) return false;
                return msg.includes('RATE_LIMIT_EXCEEDED') || msg.includes('rate limit') || msg.includes('upgrade');
            };

            if (analysisError) {
                let errMsg = analysisError.message || 'Analysis failed';
                if (analysisError.context && typeof analysisError.context.json === 'function') {
                    try {
                        const errorBody = await analysisError.context.json();
                        if (errorBody && errorBody.error) {
                            errMsg = errorBody.error;
                        }
                    } catch (e) { /* ignore */ }
                }
                if (checkRateLimit(errMsg)) {
                    useStore.getState().setShowUpgradeModal(true);
                    throw new Error('RATE_LIMIT_EXCEEDED');
                }
                throw new Error(errMsg);
            }
            if (analysisData && analysisData.error) {
                if (checkRateLimit(analysisData.error)) {
                    useStore.getState().setShowUpgradeModal(true);
                    throw new Error('RATE_LIMIT_EXCEEDED');
                }
                throw new Error(analysisData.error);
            }

            // Save to Long-Term Memory
            await this.addReportToMemory(analysisData);

            // Add report to local store
            if (analysisData.reportId) {
                const { addMedicalReport } = useStore.getState();
                if (addMedicalReport) {
                    addMedicalReport({
                        id: analysisData.reportId,
                        title: analysisData.title || fileName || 'Medical Report',
                        report_type: analysisData.report_type || 'document',
                        summary: analysisData.summary || '',
                        key_findings: analysisData.key_findings || [],
                        conditions_discussed: analysisData.conditions_discussed || [],
                        recommended_followups: analysisData.recommended_followups || [],
                        file_name: fileName || 'Uploaded File',
                        file_mime_type: mimeType,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                    });
                }
            }

            // Return analysis data PLUS the cloud URL for the chat UI
            return { ...analysisData, storagePath, signedUrl };
        } catch (error) {
            console.error('Failed to process scan:', error);
            throw error;
        }
    },

    /**
     * Get chat history from the DB.
     * Resolves storagePaths → signed cloud URLs for images.
     */
    async getChatHistory() {
        const state = useStore.getState();
        const { user } = state;
        if (!user) return [];
        
        try {
            const { data, error } = await supabase
                .from('aigirl_chat_messages')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: true })
                .limit(50);
                
            if (error) throw error;

            // Collect all storagePaths that need signed URLs
            const storagePaths = data
                .filter(msg => msg.image_uri && !msg.image_uri.startsWith('http'))
                .map(msg => msg.image_uri);

            // Batch-generate signed URLs (one API call)
            let urlMap = {};
            if (storagePaths.length > 0) {
                urlMap = await FileUploadService.getSignedUrls(storagePaths);
            }
            
            return data.map(msg => {
                let resolvedUri = msg.image_uri || null;
                // If the stored URI is a storagePath (not a full URL), resolve it
                if (resolvedUri && !resolvedUri.startsWith('http')) {
                    resolvedUri = urlMap[resolvedUri] || null;
                }
                return {
                    id: msg.id,
                    role: msg.role,
                    text: msg.content,
                    isImage: msg.is_image,
                    uri: resolvedUri,
                    storagePath: msg.image_uri, // keep the raw path for reference
                };
            });
        } catch (error) {
            console.error('Failed to fetch chat history:', error);
            return [];
        }
    },

    /**
     * Save a single chat message to the DB.
     */
    async saveMessage(role, text, isImage = false, imageUri = null) {
        const state = useStore.getState();
        const { user } = state;
        if (!user) return null;
        
        try {
            const { data, error } = await supabase
                .from('aigirl_chat_messages')
                .insert({
                    user_id: user.id,
                    role,
                    content: text,
                    is_image: isImage,
                    image_uri: imageUri
                })
                .select()
                .single();
                
            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Failed to save message:', error);
            return null;
        }
    },

    /**
     * Clear all chat history for the current user from the DB.
     */
    async clearChatHistory() {
        const state = useStore.getState();
        const { user } = state;
        if (!user) return false;
        
        try {
            const { error } = await supabase
                .from('aigirl_chat_messages')
                .delete()
                .eq('user_id', user.id);
                
            if (error) throw error;
            return true;
        } catch (error) {
            console.error('Failed to clear chat history:', error);
            return false;
        }
    },

    /**
     * Trigger background memory condensation.
     * Called on app state change (leave chat) or manually.
     */
    async triggerCondenseMemory(force = false) {
        const state = useStore.getState();
        const { user } = state;
        if (!user || !supabase) return false;

        try {
            const response = await supabase.functions.invoke('aigirl-condense-memory', {
                body: { force },
            });
            if (response.data && response.data.success && response.data.updated_facts) {
                // Update local store
                useStore.setState({ longTermFacts: response.data.updated_facts, messageCountSinceCondense: 0 });
                return true;
            }
            return false;
        } catch (error) {
            console.error('Failed to trigger memory condensation:', error);
            return false;
        }
    }
};
