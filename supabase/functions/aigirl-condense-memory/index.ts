import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

async function callGeminiChat(apiKey: string, systemInstruction: string, history: any[], newMessage: string): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-lite:generateContent?key=${apiKey}`;

    const contents = history
        .filter((msg: any) => (msg.content || msg.text || '').trim())
        .map((msg: any) => ({
            role: msg.role === 'user' ? 'user' : 'model',
            parts: [{ text: msg.content || msg.text || '' }]
        }));

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
            temperature: 0.3,
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
            temperature: 0.3,
            max_tokens: 500,
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

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders })
    }

    try {
        const SUPABASE_URL = Deno.env.get('MED_SUPABASE_URL')
        const SUPABASE_ANON_KEY = Deno.env.get('MED_SUPABASE_ANON_KEY')
        const authHeader = req.headers.get('Authorization')
        
        if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !authHeader) {
            throw new Error('Missing Auth configuration')
        }

        const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
            global: { headers: { Authorization: authHeader } }
        })

        const { data: { user } } = await supabase.auth.getUser()
        if (!user) {
            throw new Error('Unauthorized')
        }

        const body = await req.json()
        let { chat_transcript, force } = body

        // Fetch current long term facts and message count
        const { data: userData, error: userError } = await supabase
            .from('aigirl_users')
            .select('long_term_facts, message_count_since_condense, long_term_facts_updated_at')
            .eq('id', user.id)
            .single()

        if (userError) throw userError

        const msgCount = userData.message_count_since_condense || 0
        
        // If not forced and not enough messages, skip
        if (!force && msgCount < 5) {
            return new Response(JSON.stringify({ message: "Skipped: Not enough new messages." }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            })
        }

        // If chat_transcript is not provided, fetch the last 20 messages
        if (!chat_transcript) {
            const { data: msgs } = await supabase
                .from('aigirl_chat_messages')
                .select('role, content')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(20)
            
            if (msgs) {
                msgs.reverse(); // chronological
                chat_transcript = msgs.map((m: any) => `${m.role}: ${m.content}`).join('\n')
            } else {
                chat_transcript = ""
            }
        }

        if (!chat_transcript || chat_transcript.trim() === '') {
            return new Response(JSON.stringify({ message: "Skipped: Empty transcript." }), {
                headers: { ...corsHeaders, "Content-Type": "application/json" }
            })
        }

        // Fetch AI provider setting
        let USE_GEMINI = false;
        try {
            const { data: settings } = await supabase.from('aigirl_app_settings').select('use_gemini_chats').limit(1).single();
            if (settings && typeof settings.use_gemini_chats === 'boolean') {
                USE_GEMINI = settings.use_gemini_chats;
            }
        } catch (e) {
            console.warn('Failed to fetch use_gemini_chats', e);
        }

        const groqKeys = collectKeys('GROQ_KEY', 'GROQ_API_KEY')
        const geminiKeys = collectKeys('GEMINI_KEY', 'GEMINI_API_KEY')
        const GROQ_API_KEY = rotateKey(groqKeys)
        const GEMINI_API_KEY = rotateKey(geminiKeys)

        const currentFacts = userData.long_term_facts || "None";
        
        const systemInstruction = `You are summarizing a conversation between a user and their AI companion.
Here is your CURRENT memory about the user:
${currentFacts}

TASK:
Rewrite and update the CURRENT memory based on the LATEST chat session.
- Add any new important facts (preferences, life events, emotional state, relationships, interests).
- Remove trivial or outdated details.
- IMPORTANT: The final output MUST be a concise summary under 200 words.
- Output ONLY the new memory dossier, nothing else.`;

        let aiResponseText = "";
        
        try {
            if (!USE_GEMINI && GROQ_API_KEY) {
                aiResponseText = await callGroqChat(GROQ_API_KEY, systemInstruction, [], `LATEST CHAT:\n${chat_transcript}`);
            } else {
                if (!GEMINI_API_KEY) throw new Error('No AI keys available');
                aiResponseText = await callGeminiChat(GEMINI_API_KEY, systemInstruction, [], `LATEST CHAT:\n${chat_transcript}`);
            }
        } catch (primaryErr: any) {
            if (USE_GEMINI && GROQ_API_KEY) {
                aiResponseText = await callGroqChat(GROQ_API_KEY, systemInstruction, [], `LATEST CHAT:\n${chat_transcript}`);
            } else if (!USE_GEMINI && GEMINI_API_KEY) {
                aiResponseText = await callGeminiChat(GEMINI_API_KEY, systemInstruction, [], `LATEST CHAT:\n${chat_transcript}`);
            } else {
                throw primaryErr;
            }
        }

        // Update DB
        const { error: updateError } = await supabase
            .from('aigirl_users')
            .update({ 
                long_term_facts: aiResponseText.trim(),
                message_count_since_condense: 0,
                long_term_facts_updated_at: new Date().toISOString()
            })
            .eq('id', user.id)

        if (updateError) throw updateError

        return new Response(
            JSON.stringify({ success: true, updated_facts: aiResponseText.trim() }),
            { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )

    } catch (error: any) {
        console.error('Condense API Error:', error)
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        )
    }
})
