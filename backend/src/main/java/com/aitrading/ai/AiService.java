package com.aitrading.ai;

import com.aitrading.auth.UserPrincipal;
import java.util.UUID;
import java.util.concurrent.Semaphore;
import org.springframework.stereotype.Service;

/** Never hold a database transaction over a provider call, never silently retry it. */
@Service
public final class AiService {
    private final AiTurnStore turns;
    private final AiProvider provider;
    private final Semaphore active=new Semaphore(4);
    public AiService(AiTurnStore turns,AiProvider provider){this.turns=turns;this.provider=provider;}
    public AiProvider.Configuration configuration(){return provider.configuration();}
    public AiTurnStore.Turn start(UserPrincipal user,UUID conversation,UUID request,Long expected,Long source) {
        var reserved=turns.reserve(user,conversation,request,expected,source,provider.configuration());
        if(!reserved.execute())return reserved.turn();
        if(!active.tryAcquire())return turns.finish(user,conversation,request,null,AiFailure.Code.AI_BUSY);
        AiAnswer answer=null;AiFailure.Code failure=null;
        try{answer=provider.answer(reserved.context());}
        catch(AiFailure rejected){failure=rejected.code();}
        catch(RuntimeException unexpected){failure=AiFailure.Code.AI_PROVIDER_UNAVAILABLE;}
        finally{active.release();}
        return turns.finish(user,conversation,request,answer,failure);
    }
    public AiTurnStore.Turn get(UserPrincipal user,UUID conversation,UUID request){return turns.get(user,conversation,request);}
    public AiTurnStore.Turn latest(UserPrincipal user,UUID conversation){return turns.latest(user,conversation);}
    public AiTurnStore.Turn cancel(UserPrincipal user,UUID conversation,UUID request){return turns.cancel(user,conversation,request);}
}
