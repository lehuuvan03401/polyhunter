package com.polyhunter.affiliate.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.info.License;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * OpenAPI/Swagger configuration
 */
@Configuration
public class OpenApiConfig {

    @Bean
    public OpenAPI affiliateOpenAPI() {
        return new OpenAPI()
                .info(new Info()
                        .title("Horus Affiliate API")
                        .description(
                                "API for affiliate program management - referral tracking, volume attribution, and commission payouts")
                        .version("1.0.0")
                        .contact(new Contact()
                                .name("Horus Team")
                                .url("https://polyhunter.com"))
                        .license(new License()
                                .name("MIT License")
                                .url("https://opensource.org/licenses/MIT")));
    }
}
