package com.travelmate.config;

import com.fasterxml.jackson.core.JsonGenerator;
import com.fasterxml.jackson.databind.JsonSerializer;
import com.fasterxml.jackson.databind.Module;
import com.fasterxml.jackson.databind.SerializerProvider;
import com.fasterxml.jackson.databind.module.SimpleModule;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.io.IOException;
import java.math.BigDecimal;
import java.math.RoundingMode;

/**
 * API rule: money is a string decimal with 2 places. Every BigDecimal in a DTO is money
 * (coordinates and distances use double), so BigDecimal serialises as "1234.50".
 * Spring Boot registers every Module bean on the shared ObjectMapper.
 */
@Configuration
public class JacksonConfig {

    @Bean
    public Module moneyModule() {
        SimpleModule module = new SimpleModule("travelmate-money");
        module.addSerializer(BigDecimal.class, new JsonSerializer<>() {
            @Override
            public void serialize(BigDecimal value, JsonGenerator gen, SerializerProvider serializers) throws IOException {
                gen.writeString(value.setScale(2, RoundingMode.HALF_UP).toPlainString());
            }
        });
        return module;
    }
}
