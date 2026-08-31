-- Preserve existing attempts/provenance; allow only the implemented provider names.
ALTER TABLE trading.ai_turn DROP CONSTRAINT ai_turn_provider_check;
ALTER TABLE trading.ai_turn ADD CONSTRAINT ai_turn_provider_check CHECK (provider IN ('openai','gemini'));
