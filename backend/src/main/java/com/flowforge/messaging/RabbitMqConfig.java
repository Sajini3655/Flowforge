package com.flowforge.messaging;

import org.springframework.amqp.core.Binding;
import org.springframework.amqp.core.BindingBuilder;
import org.springframework.amqp.core.Queue;
import org.springframework.amqp.core.TopicExchange;
import org.springframework.amqp.core.DirectExchange;
import org.springframework.amqp.rabbit.config.SimpleRabbitListenerContainerFactory;
import org.springframework.amqp.core.AcknowledgeMode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.amqp.rabbit.connection.ConnectionFactory;
import org.springframework.amqp.rabbit.core.RabbitTemplate;
import org.springframework.amqp.support.converter.Jackson2JsonMessageConverter;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

@Configuration
public class RabbitMqConfig {

    public static final String EXCHANGE_NAME = "flowforge.jobs";
    public static final String QUEUE_NAME = "flowforge.job.queue";
    public static final String ROUTING_KEY = "job.created";
    public static final String RETRY_EXCHANGE_NAME = "flowforge.jobs.retry";
    public static final String RETRY_QUEUE_NAME = "flowforge.job.retry";
    public static final String RETRY_ROUTING_KEY = "job.retry";
    public static final String DLQ_EXCHANGE_NAME = "flowforge.jobs.dlq";
    public static final String DLQ_QUEUE_NAME = "flowforge.job.dlq";
    public static final String DLQ_ROUTING_KEY = "job.dead";

    @Bean
    TopicExchange jobExchange() {
        return new TopicExchange(EXCHANGE_NAME);
    }

    @Bean
    Queue jobQueue() {
        return new Queue(QUEUE_NAME, true);
    }

    @Bean
    DirectExchange retryExchange() {
        return new DirectExchange(RETRY_EXCHANGE_NAME);
    }

    @Bean
    Queue retryQueue(@Value("${flowforge.jobs.retry-delay-ms}") long retryDelayMs) {
        return new Queue(RETRY_QUEUE_NAME, true, false, false, java.util.Map.of(
                "x-message-ttl", retryDelayMs,
                "x-dead-letter-exchange", EXCHANGE_NAME,
                "x-dead-letter-routing-key", ROUTING_KEY));
    }

    @Bean
    Binding retryBinding(Queue retryQueue, DirectExchange retryExchange) {
        return BindingBuilder.bind(retryQueue).to(retryExchange).with(RETRY_ROUTING_KEY);
    }

    @Bean
    DirectExchange deadLetterExchange() {
        return new DirectExchange(DLQ_EXCHANGE_NAME);
    }

    @Bean
    Queue deadLetterQueue() {
        return new Queue(DLQ_QUEUE_NAME, true);
    }

    @Bean
    Binding deadLetterBinding(Queue deadLetterQueue, DirectExchange deadLetterExchange) {
        return BindingBuilder.bind(deadLetterQueue).to(deadLetterExchange).with(DLQ_ROUTING_KEY);
    }

    @Bean
    Binding jobBinding(Queue jobQueue, TopicExchange jobExchange) {
        return BindingBuilder.bind(jobQueue).to(jobExchange).with(ROUTING_KEY);
    }

    @Bean
    Jackson2JsonMessageConverter jobMessageConverter() {
        return new Jackson2JsonMessageConverter();
    }

    @Bean
    RabbitTemplate rabbitTemplate(ConnectionFactory connectionFactory,
                                  Jackson2JsonMessageConverter jobMessageConverter) {
        RabbitTemplate rabbitTemplate = new RabbitTemplate(connectionFactory);
        rabbitTemplate.setMessageConverter(jobMessageConverter);
        return rabbitTemplate;
    }

    @Bean
    SimpleRabbitListenerContainerFactory rabbitListenerContainerFactory(
            org.springframework.amqp.rabbit.connection.ConnectionFactory connectionFactory,
            Jackson2JsonMessageConverter jobMessageConverter,
            @Value("${spring.rabbitmq.listener.simple.auto-startup:true}") boolean autoStartup) {
        SimpleRabbitListenerContainerFactory factory = new SimpleRabbitListenerContainerFactory();
        factory.setConnectionFactory(connectionFactory);
        factory.setMessageConverter(jobMessageConverter);
        factory.setAcknowledgeMode(AcknowledgeMode.MANUAL);
        factory.setAutoStartup(autoStartup);
        return factory;
    }
}
