package com.flowforge;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
@org.springframework.scheduling.annotation.EnableScheduling
public class FlowForgeApplication {

    public static void main(String[] args) {
        SpringApplication.run(FlowForgeApplication.class, args);
    }
}
