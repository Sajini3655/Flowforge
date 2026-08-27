package com.flowforge.messaging;

import com.rabbitmq.client.Channel;
import org.springframework.amqp.core.Message;
import org.springframework.amqp.rabbit.annotation.RabbitListener;
import org.springframework.stereotype.Component;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.slf4j.MDC;
import com.flowforge.observability.CorrelationIdFilter;
import com.flowforge.observability.FlowForgeMetrics;

import java.io.IOException;

@Component
public class JobConsumer {

    private static final Logger log = LoggerFactory.getLogger(JobConsumer.class);

    private final JobWorker worker;
    private final JobPublisher publisher;
    private final FlowForgeMetrics metrics;

    public JobConsumer(JobWorker worker, JobPublisher publisher, FlowForgeMetrics metrics) {
        this.worker = worker;
        this.publisher = publisher;
        this.metrics = metrics == null ? FlowForgeMetrics.fallback() : metrics;
    }

    @RabbitListener(queues = RabbitMqConfig.QUEUE_NAME)
    public void consume(JobMessage message, Channel channel, Message rawMessage) throws IOException {
        String previousCorrelationId = MDC.get(CorrelationIdFilter.MDC_KEY);
        try {
            if (message.correlationId() != null) {
                MDC.put(CorrelationIdFilter.MDC_KEY, message.correlationId());
            }
            JobProcessingOutcome outcome = worker.execute(message);
            log.info("job message consumed jobId={} outcome={} correlationId={}",
                    message.jobId(), outcome, message.correlationId());
            switch (outcome) {
                case RETRYABLE_FAILURE -> {
                    publisher.publishRetry(message);
                }
                case PERMANENT_FAILURE, REDIS_UNAVAILABLE -> {
                    metrics.dlqPublication();
                    publisher.publishDeadLetter(message);
                }
                case COMPLETED, STALE, ALREADY_HANDLED -> { }
            }
        } finally {
            if (previousCorrelationId == null) MDC.remove(CorrelationIdFilter.MDC_KEY);
            else MDC.put(CorrelationIdFilter.MDC_KEY, previousCorrelationId);
        }
        channel.basicAck(rawMessage.getMessageProperties().getDeliveryTag(), false);
    }
}
