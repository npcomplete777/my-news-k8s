package com.o11ynews;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class O11yNewsApplication {

    public static void main(String[] args) {
        SpringApplication.run(O11yNewsApplication.class, args);
    }
}
