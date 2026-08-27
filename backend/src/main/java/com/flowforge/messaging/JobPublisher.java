package com.flowforge.messaging;

import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.stereotype.Component;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@Component
public class JobPublisher {

    private static final Logger log = LoggerFactory.getLogger(JobPublisher.class);

    private final RabbitTemplate rabbitTemplate;

    public JobPublisher(RabbitTemplate rabbitTemplate) {
        this.rabbitTemplate = rabbitTemplate;
    }

    public void publish(JobMessage message) {
        send(RabbitMqConfig.EXCHANGE_NAME, RabbitMqConfig.ROUTING_KEY, message);
    }

    public void publishRetry(JobMessage message) {
        send(RabbitMqConfig.RETRY_EXCHANGE_NAME, RabbitMqConfig.RETRY_ROUTING_KEY, message);
    }

    public void publishDeadLetter(JobMessage message) {
        send(RabbitMqConfig.DLQ_EXCHANGE_NAME, RabbitMqConfig.DLQ_ROUTING_KEY, message);
    }

    private void send(String exchange, String routingKey, JobMessage message) {
        log.info("publishing job event jobId={} exchange={} routingKey={} correlationId={}",
            message.jobId(), exchange, routingKey, message.correlationId());
        rabbitTemplate.convertAndSend(exchange, routingKey, message);
    }
}
