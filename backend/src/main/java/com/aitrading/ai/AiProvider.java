package com.aitrading.ai;

import java.util.List;

public interface AiProvider extends AutoCloseable {
    record Configuration(boolean configured, String provider, String model) { }
    record ContextMessage(String role, String content, byte[] imagePng) {
        public ContextMessage(String role, String content) { this(role, content, null); }
        public ContextMessage { imagePng = imagePng == null ? null : imagePng.clone(); }
        @Override public byte[] imagePng() { return imagePng == null ? null : imagePng.clone(); }
    }
    record ImageRequest(byte[] pngBytes, String question) {
        public ImageRequest { pngBytes=pngBytes==null?null:pngBytes.clone(); }
        @Override public byte[] pngBytes(){return pngBytes==null?null:pngBytes.clone();}
    }
    Configuration configuration();
    AiAnswer answer(List<ContextMessage> context);
    default AiProposal propose(List<ContextMessage> context) { throw new AiFailure(AiFailure.Code.AI_UNCONFIGURED); }
    default AiJournalEvaluation evaluateJournal(List<ContextMessage> context) { throw new AiFailure(AiFailure.Code.AI_UNCONFIGURED); }
    default AiImageAnalysis analyzeImage(ImageRequest request) { throw new AiFailure(AiFailure.Code.AI_UNCONFIGURED); }
    @Override default void close() { }
}
