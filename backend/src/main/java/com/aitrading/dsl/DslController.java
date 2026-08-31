package com.aitrading.dsl;

import java.util.Map;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/dsl")
public class DslController {
    private final DslValidator validator;
    public DslController(DslValidator validator) { this.validator = validator; }
    @GetMapping(value = "/schema", produces = "application/schema+json")
    public String schema() { return validator.schemaJson(); }
    @GetMapping("/capabilities")
    public Map<String, Object> capabilities() { return validator.capabilities(); }
    @PostMapping(value = "/validate", consumes = "application/json")
    public ResponseEntity<?> validate(@RequestBody byte[] body) {
        var result = validator.validate(body);
        return ResponseEntity.status(result.valid() ? 200 : 422).body(result);
    }
}
