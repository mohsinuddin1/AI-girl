import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ══════════════════════════════════════════════════════
//  PROMPT BUILDER
// ══════════════════════════════════════════════════════

function buildMedicalPrompt(userProfile: any): string {
    const hasProfile = userProfile && (
        (userProfile.diseases && userProfile.diseases.some((d: string) => d !== 'None')) ||
        (userProfile.allergies && userProfile.allergies.some((a: string) => a !== 'None')) ||
        (userProfile.goals && userProfile.goals.length > 0)
    );

    let profileContext = "";
    if (hasProfile) {
        const diseases = (userProfile.diseases || []).filter((x: string) => x !== 'None').join(', ');
        const allergies = (userProfile.allergies || []).filter((x: string) => x !== 'None').join(', ');
        const goals = (userProfile.goals || []).filter(Boolean).join(', ');
        profileContext = `
USER PROFILE:
- Conditions: ${diseases}
- Allergies: ${allergies}
- Goals: ${goals}
Please contextualize the findings based on this profile if relevant.
`;
    }

    return `You are an expert medical assistant. Analyze the provided medical report, prescription, or medicine scan.
Explain the findings in simple language that a patient can easily understand.
Identify what is increased, what is decreased, and what is normal.
Provide a simple, clear summary. Do not overcomplicate or bloat the response.

${profileContext}

Return the result in JSON format EXACTLY matching this structure:
{
  "report_type": "string (e.g., Blood Test, Prescription, Medicine)",
  "title": "string (A short descriptive title for this report, e.g., 'Complete Blood Count Results', 'Metformin Prescription')",
  "summary": "string (Clear, simple explanation of the document. Talk directly to the user.)",
  "key_findings": ["string (e.g., High LDL cholesterol)"],
  "conditions_discussed": ["string"],
  "recommended_followups": ["string (General non-diagnostic next steps)"],
  "citations": ["string (Source if 100% true, else omit)"]
}`;
}

// ══════════════════════════════════════════════════════
//  UTILITIES
// ══════════════════════════════════════════════════════

function arrayBufferToBase64(buffer: ArrayBuffer): string {
    const bytes = new Uint8Array(buffer)
    let binary = ""
    const chunkSize = 0x8000
    for (let i = 0; i < bytes.length; i += chunkSize) {
        const chunk = bytes.subarray(i, i + chunkSize)
        binary += String.fromCharCode.apply(null, chunk as any)
    }
    return btoa(binary)
}

async function fetchFileAsBase64(url: string): Promise<{ base64: string, mimeType: string }> {
    const MAX_SIZE = 4 * 1024 * 1024;
    const res = await fetch(url)
    if (!res.ok) throw new Error("File fetch failed")

    const contentType = res.headers.get('content-type') || 'image/jpeg';
    const buffer = await res.arrayBuffer()
    const bytes = new Uint8Array(buffer)

    if (bytes.length <= MAX_SIZE) {
        return { base64: arrayBufferToBase64(buffer), mimeType: contentType };
    }
    const reduced = bytes.slice(0, MAX_SIZE)
    return { base64: arrayBufferToBase64(reduced.buffer), mimeType: contentType };
}

function cleanAndParseJSON(raw: string): any {
    let cleaned = raw
    cleaned = cleaned.replace(/~"/g, '"')
    cleaned = cleaned.replace(/~'/g, "'")
    cleaned = cleaned.replace(/\{\s*\{(\s*")/g, '{$1')
    cleaned = cleaned.replace(/\}\s*\}/g, '}')
    cleaned = cleaned.replace(/,\s*([}\]])/g, '$1')

    const match = cleaned.match(/\{[\s\S]*\}/)
    if (match) {
        return JSON.parse(match[0])
    }
    throw new Error('Could not recover JSON from AI response')
}

// ══════════════════════════════════════════════════════
//  AI PROVIDERS
// ══════════════════════════════════════════════════════

async function uploadToGeminiFileAPI(apiKey: string, blob: Blob, mimeType: string): Promise<string> {
    const uploadUrl = `https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`;
    const res = await fetch(uploadUrl, {
        method: "POST",
        headers: {
            "X-Goog-Upload-Command": "start, upload, finalize",
            "X-Goog-Upload-Header-Content-Length": blob.size.toString(),
            "X-Goog-Upload-Header-Content-Type": mimeType,
            "Content-Type": mimeType
        },
        body: blob
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini File API Upload Error: ${errText.substring(0, 300)}`);
    }

    const data = await res.json();
    return data.file.uri;
}

async function callGeminiVision(apiKey: string, prompt: string, fileDataInfo: { base64?: string, uri?: string, mimeType: string }): Promise<any> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;

    const filePart = fileDataInfo.uri ? {
        file_data: {
            mime_type: fileDataInfo.mimeType,
            file_uri: fileDataInfo.uri
        }
    } : {
        inline_data: {
            mime_type: fileDataInfo.mimeType,
            data: fileDataInfo.base64
        }
    };

    const requestBody = {
        contents: [{
            parts: [
                { text: prompt },
                filePart
            ]
        }],
        generationConfig: {
            temperature: 0.2,
            responseMimeType: "application/json"
        }
    };

    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody)
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Gemini API Error: ${errText.substring(0, 300)}`);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error("No response from Gemini");

    return cleanAndParseJSON(text);
}

async function callGroqVision(apiKey: string, prompt: string, fileDataInfo: { base64?: string, url?: string }): Promise<any> {
    const imageUrlObj = fileDataInfo.url ? { url: fileDataInfo.url } : { url: `data:image/jpeg;base64,${fileDataInfo.base64}` };
    const requestBody = {
        model: "meta-llama/llama-4-scout-17b-16e-instruct",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
            { role: "system", content: "You are a precise JSON data extractor. Only output valid JSON formatting." },
            {
                role: "user",
                content: [
                    { type: "text", text: prompt },
                    { type: "image_url", image_url: imageUrlObj }
                ]
            }
        ]
    };

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
        body: JSON.stringify(requestBody)
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Groq API Error: ${errText.substring(0, 300)}`);
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    if (!text) throw new Error("No response from Groq");

    return cleanAndParseJSON(text);
}

// ══════════════════════════════════════════════════════
//  SCAN CREDIT REFUND
// ══════════════════════════════════════════════════════

async function refundScanCredit(userId: string, isTester: boolean): Promise<void> {
    if (userId === 'anonymous' || isTester) return;
    try {
        const serviceKey = Deno.env.get('MED_SUPABASE_SERVICE_ROLE_KEY')
        const supabaseUrl = Deno.env.get('MED_SUPABASE_URL')
        if (!serviceKey || !supabaseUrl) return

        const adminClient = createClient(supabaseUrl, serviceKey)
        const { data: usage } = await adminClient.from('scan_usage')
            .select('daily_scans, weekly_scans, monthly_scans')
            .eq('user_id', userId).single()

        if (usage) {
            const newDaily = Math.max(0, usage.daily_scans - 1)
            await adminClient.from('scan_usage').update({
                daily_scans: newDaily,
                weekly_scans: Math.max(0, usage.weekly_scans - 1),
                monthly_scans: Math.max(0, usage.monthly_scans - 1)
            }).eq('user_id', userId)
            await adminClient.from('users').update({ daily_scans: newDaily }).eq('id', userId)
            console.log(`🔄 Refunded scan credit for user ${userId}`)
        }
    } catch (err) {
        console.error('Refund failed:', err)
    }
}

// ══════════════════════════════════════════════════════
//  FETCH USER HEALTH PROFILE
// ══════════════════════════════════════════════════════

async function fetchUserHealthProfile(supabase: any, userId: string): Promise<any | null> {
    try {
        const { data, error } = await supabase
            .from('users')
            .select('health_preferences')
            .eq('id', userId)
            .single()

        if (error || !data?.health_preferences) return null

        const prefs = data.health_preferences
        return {
            diseases: prefs.diseases || [],
            allergies: prefs.allergies || [],
            goals: prefs.goals || [],
        }
    } catch {
        return null
    }
}

// ══════════════════════════════════════════════════════
//  COLLECT API KEYS
// ══════════════════════════════════════════════════════

function collectKeys(prefix: string, legacyKey: string): string[] {
    const keys: string[] = []
    for (let i = 1; i <= 10; i++) {
        const k = Deno.env.get(`${prefix}${i}`)
        if (k) keys.push(k.trim())
    }
    if (keys.length === 0) {
        const legacy = Deno.env.get(legacyKey)
        if (legacy) keys.push(legacy.trim())
    }
    return keys
}

function rotateKey(keys: string[]): string | null {
    if (keys.length === 0) return null
    const timeIndex = Math.floor((new Date().getUTCHours() * 60 + new Date().getUTCMinutes()) / 30);
    return keys[timeIndex % keys.length]
}

// ══════════════════════════════════════════════════════
//  SAVE REPORT TO DATABASE
// ══════════════════════════════════════════════════════

async function saveReportToDatabase(
    adminClient: any,
    userId: string,
    analysisResult: any,
    storagePath: string | null,
    mimeType: string,
    fileName: string | null
): Promise<string | null> {
    try {
        const { data, error } = await adminClient
            .from('medical_reports')
            .insert({
                user_id: userId,
                title: analysisResult.title || analysisResult.report_type || 'Medical Report',
                report_type: analysisResult.report_type || 'document',
                summary: analysisResult.summary || '',
                key_findings: analysisResult.key_findings || [],
                conditions_discussed: analysisResult.conditions_discussed || [],
                recommended_followups: analysisResult.recommended_followups || [],
                file_storage_path: storagePath,
                file_mime_type: mimeType,
                file_name: fileName,
                raw_analysis: analysisResult,
            })
            .select('id')
            .single();

        if (error) {
            console.error('❌ Failed to save report to DB:', error);
            return null;
        }

        console.log(`✅ Report saved to DB: ${data.id}`);
        return data.id;
    } catch (err) {
        console.error('❌ saveReportToDatabase error:', err);
        return null;
    }
}

// ══════════════════════════════════════════════════════
//  MAIN HANDLER
// ══════════════════════════════════════════════════════

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    let userId = 'anonymous'
    let isTester = false

    try {
        // ── 1. Environment & Auth ──
        const SUPABASE_URL = Deno.env.get('MED_SUPABASE_URL') || Deno.env.get('SUPABASE_URL')
        const SUPABASE_ANON_KEY = Deno.env.get('MED_SUPABASE_ANON_KEY') || Deno.env.get('SUPABASE_ANON_KEY')
        const SERVICE_ROLE_KEY = Deno.env.get('MED_SUPABASE_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')

        const geminiKeys = collectKeys('GEMINI_KEY', 'GEMINI_API_KEY')
        const GEMINI_API_KEY = rotateKey(geminiKeys)
        const groqKeys = collectKeys('GROQ_KEY', 'GROQ_API_KEY')
        const GROQ_API_KEY = rotateKey(groqKeys)

        if (!SUPABASE_URL || !SUPABASE_ANON_KEY) throw new Error('Missing Supabase Config')
        if (!GEMINI_API_KEY) throw new Error('No Gemini API key configured')

        // Create scoped client
        const authHeader = req.headers.get('Authorization')
        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: { headers: authHeader ? { Authorization: authHeader } : {} }
        })

        // Create admin client for Storage + DB operations
        const adminClient = SERVICE_ROLE_KEY
            ? createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
            : null;

        // Identify user
        let userProfile = null;
        if (authHeader) {
            try {
                const { data: { user }, error: authError } = await supabase.auth.getUser()
                if (!authError && user) {
                    userId = user.id
                    isTester = user.email === 'tester@medicalgpt.ai'
                }
            } catch {
                console.warn('Auth check failed, proceeding as anonymous')
            }
        }

        let USE_GEMINI = true;
        if (adminClient) {
            try {
                const { data: settings } = await adminClient.from('app_settings').select('use_gemini').limit(1).single();
                if (settings && typeof settings.use_gemini === 'boolean') {
                    USE_GEMINI = settings.use_gemini;
                }
            } catch (e) {
                console.warn('Failed to fetch use_gemini from app_settings', e);
            }
        }

        // ── Rate Limiting (uses scan_usage — document analysis is expensive like scans) ──
        if (userId !== 'anonymous' && !isTester) {
            const { error: usageError } = await supabase.rpc('increment_scan_usage', { p_user_id: userId })
            if (usageError) {
                if (usageError.message?.includes('RATE_LIMIT_EXCEEDED') || usageError.message?.includes('Limit')) {
                    return new Response(JSON.stringify({
                        error: 'RATE_LIMIT_EXCEEDED: You have reached your daily scan limit. Please upgrade to Pro for unlimited access.'
                    }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } })
                }
                // Non-rate-limit error (e.g. function not found) — log but continue.
                // Scan should still work; rate limiting activates once the DB migration is applied.
                console.warn('Scan usage tracking failed (non-blocking):', usageError.message || usageError)
            }
        }

        // ── 2. Parse Request (ONCE — body stream can only be read once) ──
        const body = await req.json()
        const {
            imageUrl,
            imageBase64,
            healthPreferences,
            mimeType: clientMimeType,
            storagePath,       // NEW: from Strategy A upload
            fileName,          // NEW: original file name
        } = body

        // ── 3. Resolve Health Profile ──
        if (healthPreferences && (healthPreferences.diseases?.length || healthPreferences.allergies?.length || healthPreferences.goals?.length)) {
            userProfile = healthPreferences
        } else if (userId !== 'anonymous') {
            userProfile = await fetchUserHealthProfile(supabase, userId)
        }

        // ── 4. Image/File Handling ──
        let finalBase64 = imageBase64
        let fileUri = null
        let mimeType = clientMimeType || 'image/jpeg'
        let signedUrl = null

        // ── Strategy A: Fetch from Supabase Storage ──
        if (storagePath && adminClient) {
            console.log(`📦 Fetching file from Storage: ${storagePath}`)

            // For Groq (or Gemini Fallback) get signed URL
            const { data: urlData } = await adminClient.storage
                .from('medical-uploads')
                .createSignedUrl(storagePath, 60 * 5); // 5 mins
            if (urlData?.signedUrl) {
                signedUrl = urlData.signedUrl;
            }

            // For Gemini, we must download and upload to File API
            if (mimeType === 'application/pdf' || USE_GEMINI) {
                const { data: fileData, error: downloadError } = await adminClient.storage
                    .from('medical-uploads')
                    .download(storagePath);

                if (downloadError || !fileData) {
                    throw new Error(`Failed to download file from Storage: ${downloadError?.message || 'No data'}`);
                }

                console.log(`📤 Uploading file directly to Gemini File API (${(fileData.size / 1024).toFixed(0)} KB)...`);
                fileUri = await uploadToGeminiFileAPI(GEMINI_API_KEY, fileData, mimeType);
                console.log(`✅ Uploaded to Gemini: ${fileUri}`);
            }
        } else if (finalBase64) {
            // ── Legacy: base64 sent directly from client ──
            if (finalBase64.startsWith("data:application/pdf")) mimeType = "application/pdf";
            else if (finalBase64.startsWith("data:image/png")) mimeType = "image/png";
            else if (finalBase64.startsWith("data:image/webp")) mimeType = "image/webp";

            // Strip data URI prefix to get raw base64
            finalBase64 = finalBase64.includes(",") ? finalBase64.split(",")[1] : finalBase64
        } else if (imageUrl) {
            const fileData = await fetchFileAsBase64(imageUrl);
            finalBase64 = fileData.base64;
            mimeType = fileData.mimeType;
        }

        if (!finalBase64 && !fileUri && !signedUrl) {
            throw new Error('No image or file data provided')
        }

        // ── 5. Build Prompt & Call AI ──
        const prompt = buildMedicalPrompt(userProfile);
        let analysisResult: any;

        try {
            if (mimeType !== 'application/pdf' && !USE_GEMINI && GROQ_API_KEY) {
                console.log(`🚀 Analyzing with Groq (Mime: ${mimeType})`)
                // Use signed URL if available, otherwise fallback to base64
                analysisResult = await callGroqVision(GROQ_API_KEY, prompt, { url: signedUrl || undefined, base64: finalBase64 });
            } else {
                console.log(`🚀 Analyzing with Gemini (Mime: ${mimeType})`)
                analysisResult = await callGeminiVision(GEMINI_API_KEY, prompt, { uri: fileUri, base64: finalBase64, mimeType });
            }

            if (!analysisResult.citations || !Array.isArray(analysisResult.citations) || analysisResult.citations.length === 0) {
                analysisResult.citations = [
                    "World Health Organization (WHO) - General Wellness Guidelines",
                    "National Institutes of Health (NIH) - Health Information",
                    "Mayo Clinic - Patient Care & Health Information"
                ];
            }
        } catch (aiErr: any) {
            console.error('❌ AI analysis failed:', aiErr.message)
            await refundScanCredit(userId, isTester)

            return new Response(JSON.stringify({
                report_type: 'Unknown',
                summary: 'AI analysis temporarily unavailable. Please try again.',
                key_findings: [],
                conditions_discussed: [],
                recommended_followups: [],
                error: aiErr.message
            }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            })
        }

        // ── 6. Save Report to Database ──
        let reportId: string | null = null;
        if (userId !== 'anonymous' && adminClient) {
            reportId = await saveReportToDatabase(
                adminClient,
                userId,
                analysisResult,
                storagePath || null,
                mimeType,
                fileName || null
            );
        }

        // ── 7. Final Response ──
        return new Response(
            JSON.stringify({
                ...analysisResult,
                reportId,    // Include report ID so client can reference it
            }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )

    } catch (error) {
        console.error(error)
        await refundScanCredit(userId, isTester)

        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
    }
})