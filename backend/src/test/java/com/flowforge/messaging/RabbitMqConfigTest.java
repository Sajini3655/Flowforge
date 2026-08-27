package com.flowforge.messaging;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class RabbitMqConfigTest {

    private final RabbitMqConfig config = new RabbitMqConfig();

    @Test
    void mainTopologyUsesExpectedNames() {
        assertThat(config.jobExchange().getName()).isEqualTo(RabbitMqConfig.EXCHANGE_NAME);
        assertThat(config.jobQueue().getName()).isEqualTo(RabbitMqConfig.QUEUE_NAME);
        assertThat(config.jobBinding(config.jobQueue(), config.jobExchange()).getRoutingKey())
                .isEqualTo(RabbitMqConfig.ROUTING_KEY);
    }

    @Test
    void retryTopologyDeadLettersBackToMainQueue() {
        var retryExchange = config.retryExchange();
        var retryQueue = config.retryQueue(5000);
        var retryBinding = config.retryBinding(retryQueue, retryExchange);

        assertThat(retryExchange.getName()).isEqualTo(RabbitMqConfig.RETRY_EXCHANGE_NAME);
        assertThat(retryQueue.getName()).isEqualTo(RabbitMqConfig.RETRY_QUEUE_NAME);
        assertThat(retryQueue.getArguments())
                .containsEntry("x-message-ttl", 5000L)
                .containsEntry("x-dead-letter-exchange", RabbitMqConfig.EXCHANGE_NAME)
                .containsEntry("x-dead-letter-routing-key", RabbitMqConfig.ROUTING_KEY);
        assertThat(retryBinding.getRoutingKey()).isEqualTo(RabbitMqConfig.RETRY_ROUTING_KEY);
    }

    @Test
    void deadLetterTopologyUsesExpectedNames() {
        var exchange = config.deadLetterExchange();
        var queue = config.deadLetterQueue();
        var binding = config.deadLetterBinding(queue, exchange);

        assertThat(exchange.getName()).isEqualTo(RabbitMqConfig.DLQ_EXCHANGE_NAME);
        assertThat(queue.getName()).isEqualTo(RabbitMqConfig.DLQ_QUEUE_NAME);
        assertThat(binding.getRoutingKey()).isEqualTo(RabbitMqConfig.DLQ_ROUTING_KEY);
    }
}
