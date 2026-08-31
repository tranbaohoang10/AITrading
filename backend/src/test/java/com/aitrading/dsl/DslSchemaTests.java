package com.aitrading.dsl;

import static org.assertj.core.api.Assertions.*;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.util.HexFormat;
import org.junit.jupiter.api.Test;
import tools.jackson.databind.json.JsonMapper;

class DslSchemaTests {
    final JsonMapper json=JsonMapper.builder().build();

    @Test void publishedV1SchemaFingerprintCannotSilentlyChange() throws Exception {
        String expected;
        try(var resource=getClass().getResourceAsStream("/dsl/schema-sha256.txt")) {
            expected=new String(resource.readAllBytes(),StandardCharsets.UTF_8).strip();
        }
        String normalized=new DslValidator().schemaJson().replace("\r\n","\n");
        String actual=HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(normalized.getBytes(StandardCharsets.UTF_8)));
        assertThat(actual).as("Publish a new schema version instead of rewriting 1.0.0").isEqualTo(expected);
    }

    @Test void unsupportedKeywordsRemoteRefsAndOpenObjectsCannotBecomeTrustedSchema() {
        for(String schema:new String[]{"null","{\"$ref\":\"https://127.0.0.1/schema\"}",
                "{\"format\":\"executable-code\"}","{\"type\":\"object\",\"properties\":{},\"additionalProperties\":true}"})
            assertThatThrownBy(()->new DslSchema(json.readTree(schema))).isInstanceOf(IllegalStateException.class);
    }
}
