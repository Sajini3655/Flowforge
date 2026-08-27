# ADR 0001: Start as a Modular Monolith

## Decision

FlowForge starts as one Spring Boot application rather than several microservices.

## Why

The first goal is to understand the domain and establish a working MVP. Splitting
into microservices before there is a real boundary would add operational complexity
without providing a useful benefit.

RabbitMQ and a separate worker service will be introduced later when asynchronous
processing becomes an actual requirement.
