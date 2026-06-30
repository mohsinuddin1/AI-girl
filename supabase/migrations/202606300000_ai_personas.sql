-- Create the ai_personas table
CREATE TABLE IF NOT EXISTS ai_personas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    name TEXT NOT NULL,
    image_url TEXT NOT NULL,
    personality JSONB NOT NULL,
    extra_demand TEXT,
    is_visible BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert dummy data (9:16 aspect ratio images)
INSERT INTO ai_personas (name, image_url, personality, extra_demand, is_visible) VALUES
('Luna', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=540&h=960&fit=crop', '{"shyFlirty": 0.8, "pessOpt": 0.6, "ordMyst": 0.9}', 'I love talking about the universe and stars.', true),
('Emma', 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=540&h=960&fit=crop', '{"shyFlirty": 0.4, "pessOpt": 0.9, "ordMyst": 0.3}', 'I am very practical and optimistic.', true),
('Sophie', 'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=540&h=960&fit=crop', '{"shyFlirty": 0.2, "pessOpt": 0.4, "ordMyst": 0.2}', 'I enjoy reading classic literature and drinking tea.', true),
('Chloe', 'https://images.unsplash.com/photo-1529626455594-4ff0802cfb7e?w=540&h=960&fit=crop', '{"shyFlirty": 0.9, "pessOpt": 0.8, "ordMyst": 0.7}', 'Always ready for a fun adventure and joking around.', true),
('Custom Girl', 'https://images.unsplash.com/photo-1525875975471-999f65706a10?w=540&h=960&fit=crop', '{"shyFlirty": 0.5, "pessOpt": 0.5, "ordMyst": 0.5}', 'I am a custom AI persona. Tell me how you want me to behave.', true);
