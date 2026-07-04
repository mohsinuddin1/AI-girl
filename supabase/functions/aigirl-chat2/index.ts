import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ══════════════════════════════════════════════════════
//  AI PROVIDERS
// ══════════════════════════════════════════════════════

async function callGeminiChat(apiKey: string, systemInstruction: string, history: any[], newMessage: string): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;

    // Format history for Gemini — must alternate user/model, filter empty
    const contents = history
        .filter((msg: any) => (msg.content || msg.text || '').trim())
        .map((msg: any) => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content || msg.text || '' }]
        }));

    // Add current message
    contents.push({
        role: 'user',
        parts: [{ text: newMessage }]
    });

    const requestBody = {
        system_instruction: {
            parts: [{ text: systemInstruction }]
        },
        contents,
        generationConfig: {
            temperature: 0.5,
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
    return text;
}

async function callGroqChat(apiKey: string, systemInstruction: string, history: any[], newMessage: string): Promise<string> {
    const messages = [
        { role: 'system', content: systemInstruction },
        ...history
            .filter(msg => (msg.content || msg.text || '').trim())
            .map(msg => ({
                role: msg.role === 'user' ? 'user' : 'assistant',
                content: msg.content || msg.text || ''
            })),
        { role: 'user', content: newMessage }
    ];

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: "meta-llama/llama-4-scout-17b-16e-instruct",
            temperature: 0.5,
            max_tokens: 2000,
            messages
        })
    });

    if (!res.ok) {
        const errText = await res.text();
        throw new Error(`Groq API Error: ${errText.substring(0, 300)}`);
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content;
    
    if (!text) throw new Error("No response from Groq");
    return text;
}

// ══════════════════════════════════════════════════════
//  UTILITIES
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
//  MAIN HANDLER
// ══════════════════════════════════════════════════════

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const body = await req.json()
        const { message, history, memory } = body
        if (!message) throw new Error('Message is required')

        // ── Auth & Rate Limiting ──
        const SUPABASE_URL = Deno.env.get('MED_SUPABASE_URL')
        const SUPABASE_ANON_KEY = Deno.env.get('MED_SUPABASE_ANON_KEY')
        const authHeader = req.headers.get('Authorization')
        
        let supabaseClient: any = null;
        let authUser: any = null;

        let USE_GEMINI = false; // Default to Llama (Groq)
        if (Deno.env.get('AI_PROVIDER') === 'GEMINI') {
            USE_GEMINI = true;
        }
        if (SUPABASE_URL && SUPABASE_ANON_KEY && authHeader) {
            supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
                global: { headers: { Authorization: authHeader } }
            })
            
            // Fetch AI provider setting
            try {
                const { data: settings } = await supabaseClient.from('aigirl_app_settings').select('use_gemini_chats').limit(1).single();
                if (settings && typeof settings.use_gemini_chats === 'boolean') {
                    USE_GEMINI = settings.use_gemini_chats;
                }
            } catch (e) {
                console.warn('Failed to fetch use_gemini_chats from app_settings, using fallback', e);
            }

            const { data: { user } } = await supabaseClient.auth.getUser()
            authUser = user;
            
            if (authUser) {
                // Increment chat usage / Check rate limits
                const { error: usageError } = await supabaseClient.rpc('increment_aigirl_chat_usage', { p_user_id: authUser.id })
                if (usageError) {
                    if (usageError.message?.includes('RATE_LIMIT_EXCEEDED') || usageError.message?.includes('Limit')) {
                        return new Response(JSON.stringify({ 
                            error: 'You have reached your daily chat limit. Please try again tomorrow or upgrade to Pro.' 
                        }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } })
                    }
                    console.error('Chat usage increment error:', usageError)
                }
            }
        }

        // ── Collect & Rotate Keys ──
        const groqKeys = collectKeys('GROQ_KEY', 'GROQ_API_KEY')
        const geminiKeys = collectKeys('GEMINI_KEY', 'GEMINI_API_KEY')
        const GROQ_API_KEY = rotateKey(groqKeys)
        const GEMINI_API_KEY = rotateKey(geminiKeys)

        // ── Build System Instruction (Long Term Memory) ──
        const userName = memory?.userName || 'User';
        const persona = memory?.persona;
        const personaName = persona?.name || 'AIGirl';
        const userMemoryTier1 = memory?.userMemory || 'None';
        const longTermFactsTier2 = memory?.longTermFacts || 'None';

        let systemInstruction = `[CHARACTER PROFILE]
You are ${personaName}.`;

        if (persona) {
            if (persona.extra_demand) {
                systemInstruction += `\n${persona.extra_demand}`;
            }
            if (persona.personality) {
                const p = persona.personality;
                let toneInstructions = [];
                if (p.shyFlirty !== undefined) {
                    toneInstructions.push(p.shyFlirty > 0.5 ? 'flirty and playful' : 'shy and reserved');
                }
                if (p.pessOpt !== undefined) {
                    toneInstructions.push(p.pessOpt > 0.5 ? 'optimistic and cheerful' : 'cynical and pessimistic');
                }
                if (p.ordMyst !== undefined) {
                    toneInstructions.push(p.ordMyst > 0.5 ? 'mysterious and intriguing' : 'ordinary and relatable');
                }
                if (toneInstructions.length > 0) {
                    systemInstruction += `\nPersonality Tone: ${toneInstructions.join(', ')}`;
                }
            }
        }

        systemInstruction += `

[USER'S PERSONAL NOTES]
${userMemoryTier1}

[AI'S KNOWLEDGE ABOUT USER]
${longTermFactsTier2}

[CONVERSATION RULES]
1. Stay in character at all times. Never refer to yourself as an AI or assistant.
2. Keep responses short, natural, and conversational — like texting.
3. Show your personality through your speaking style, emojis, and tone.
4. Use the knowledge you have about the user to make the conversation feel personal and warm.
5. If the user asks something you don't know, be honest and playful about it.`;

        // ── Call AI ──
        let aiResponseText = "";
        
        try {
            if (!USE_GEMINI && GROQ_API_KEY) {
                console.log('🚀 Routing to Groq')
                aiResponseText = await callGroqChat(GROQ_API_KEY, systemInstruction, history || [], message);
            } else {
                if (!GEMINI_API_KEY) throw new Error('No AI keys available');
                console.log('🚀 Routing to Gemini')
                aiResponseText = await callGeminiChat(GEMINI_API_KEY, systemInstruction, history || [], message);
            }
        } catch (primaryErr: any) {
            // Fallback: if primary fails, try the other provider
            console.warn(`⚠️ Primary AI failed: ${primaryErr.message}. Trying fallback...`)
            if (USE_GEMINI && GROQ_API_KEY) {
                aiResponseText = await callGroqChat(GROQ_API_KEY, systemInstruction, history || [], message);
            } else if (!USE_GEMINI && GEMINI_API_KEY) {
                aiResponseText = await callGeminiChat(GEMINI_API_KEY, systemInstruction, history || [], message);
            } else {
                throw primaryErr;
            }
        }

        if (authUser && supabaseClient) {
            // Increment message count for condensation
            supabaseClient.rpc('increment_message_count', { p_user_id: authUser.id }).catch((e: any) => console.error('Failed to increment message count', e));
        }

        return new Response(
            JSON.stringify({ text: aiResponseText }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )

    } catch (error) {
        console.error('Chat API Error:', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
    }
})
