package com.aitrading.image;
import com.aitrading.ai.*;import com.aitrading.api.ApiErrors;import com.aitrading.auth.UserPrincipal;import com.aitrading.strategy.StrategyService;import jakarta.servlet.http.HttpServletRequest;import java.util.*;import org.springframework.http.*;import org.springframework.security.core.annotation.AuthenticationPrincipal;import org.springframework.web.bind.annotation.*;import org.springframework.web.multipart.MultipartFile;
@RestController @RequestMapping("/api/image-analyses") public class ImageAnalysisController{
 private final ImageAnalysisService service;public ImageAnalysisController(ImageAnalysisService s){service=s;}
 @GetMapping public List<ImageAnalysisStore.Saved> list(@AuthenticationPrincipal UserPrincipal u){return service.list(u);}
 @GetMapping("/{id}")public ImageAnalysisStore.Saved get(@AuthenticationPrincipal UserPrincipal u,@PathVariable String id){return service.get(u,StrategyService.id(id));}
 @PostMapping(consumes=MediaType.MULTIPART_FORM_DATA_VALUE)public ImageAnalysisStore.Saved create(@AuthenticationPrincipal UserPrincipal u,@RequestParam String requestId,@RequestParam String question,@RequestPart("file") MultipartFile file){return service.analyze(u,requestId,question,file);}
 @ExceptionHandler(AiFailure.class)public ResponseEntity<?> ai(HttpServletRequest request,AiFailure f){return ResponseEntity.status(503).body(Map.of("code",f.code().name(),"requestId",ApiErrors.requestId(request)));}
}
