package com.aitrading.generation;

import com.aitrading.ai.*;
import com.aitrading.auth.UserPrincipal;
import java.util.UUID;
import org.springframework.stereotype.Service;

@Service
public class GenerationService {
    private final GenerationStore store;private final AiProvider provider;
    public GenerationService(GenerationStore store,AiProvider provider){this.store=store;this.provider=provider;}
    public GenerationStore.Attempt start(UserPrincipal user,UUID strategy,GenerationStore.Start input) {
        var reserved=store.reserve(user,strategy,input,provider.configuration());
        if(!reserved.execute())return reserved.attempt();
        AiProposal proposal=null;AiFailure.Code failure=null;
        try{proposal=provider.propose(reserved.context());}
        catch(AiFailure rejected){failure=rejected.code();}
        catch(RuntimeException unavailable){failure=AiFailure.Code.AI_PROVIDER_UNAVAILABLE;}
        return store.finish(user,strategy,reserved.attempt().requestId(),proposal,failure);
    }
}
