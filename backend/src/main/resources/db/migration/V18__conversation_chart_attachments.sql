ALTER TABLE trading.conversation_message
    ADD COLUMN attachment_png BYTEA,
    ADD COLUMN attachment_mime VARCHAR(32),
    ADD COLUMN attachment_context TEXT;

ALTER TABLE trading.conversation_message
    ADD CONSTRAINT conversation_message_attachment_check CHECK (
        (attachment_png IS NULL AND attachment_mime IS NULL AND attachment_context IS NULL)
        OR (attachment_png IS NOT NULL AND length(attachment_png) BETWEEN 32 AND 2097152
            AND attachment_mime = 'image/png'
            AND attachment_context IS NOT NULL AND length(attachment_context) BETWEEN 1 AND 4000)
    );
