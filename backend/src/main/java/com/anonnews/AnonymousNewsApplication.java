package com.anonnews;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class AnonymousNewsApplication {

    public static void main(String[] args) {
        SpringApplication.run(AnonymousNewsApplication.class, args);
    }
}
