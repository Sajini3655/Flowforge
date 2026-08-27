package com.flowforge.messaging;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.amqp.rabbit.core.RabbitTemplate;

import java.util.UUID;

import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class JobPublisherTest {

    @Mock
    private RabbitTemplate rabbitTemplate;

    @InjectMocks
    private JobPublisher publisher;

    @Test
    void publishSendsMessageToConfiguredExchangeAndRoutingKey() {
        JobMessage message = new JobMessage(
                UUID.randomUUID(),
                "REPORT",
                "{\"projectId\":123}",
                UUID.randomUUID());

        publisher.publish(message);

        verify(rabbitTemplate).convertAndSend(
                RabbitMqConfig.EXCHANGE_NAME,
                RabbitMqConfig.ROUTING_KEY,
                message);
    }

    @Test
    void publishRetryUsesRetryExchangeAndRoutingKey() {
        JobMessage message = new JobMessage(UUID.randomUUID(), "ECHO", "payload", UUID.randomUUID());

        publisher.publishRetry(message);

        verify(rabbitTemplate).convertAndSend(
                RabbitMqConfig.RETRY_EXCHANGE_NAME,
                RabbitMqConfig.RETRY_ROUTING_KEY,
                message);
    }

    @Test
    void publishDeadLetterUsesDeadLetterExchangeAndRoutingKey() {
        JobMessage message = new JobMessage(UUID.randomUUID(), "ECHO", "payload", UUID.randomUUID());

        publisher.publishDeadLetter(message);

        verify(rabbitTemplate).convertAndSend(
                RabbitMqConfig.DLQ_EXCHANGE_NAME,
                RabbitMqConfig.DLQ_ROUTING_KEY,
                message);
    }
}
