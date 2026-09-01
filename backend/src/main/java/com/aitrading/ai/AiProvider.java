package com.aitrading.ai;

import java.util.List;

public interface AiProvider extends AutoCloseable {
    record Configuration(boolean configured, String provider, String model) { }
    record ContextMessage(String role, String content) { }
    Configuration configuration();
    AiAnswer answer(List<ContextMessage> context);
    default AiProposal propose(List<ContextMessage> context) { throw new AiFailure(AiFailure.Code.AI_UNCONFIGURED); }
    default AiJournalEvaluation evaluateJournal(List<ContextMessage> context) { throw new AiFailure(AiFailure.Code.AI_UNCONFIGURED); }
    @Override default void close() { }
}
