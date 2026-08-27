package com.flowforge.messaging;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.UUID;
import com.rabbitmq.client.Channel;
import org.springframework.amqp.core.Message;

import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class JobConsumerTest {

    @Mock
    private JobWorker worker;

    @Mock
    private JobPublisher publisher;

    @Mock
    private Channel channel;

    @Mock
    private Message rawMessage;

    @InjectMocks
    private JobConsumer consumer;

    @Test
    void consumeDelegatesReceivedMessageToWorker() throws Exception {
        JobMessage message = new JobMessage(
                UUID.randomUUID(),
                "ECHO",
                "hello flowforge",
                UUID.randomUUID());

        prepareMessage(42L);
        when(worker.execute(message)).thenReturn(JobProcessingOutcome.COMPLETED);

        consume(message);

        verify(worker).execute(message);
        verify(channel).basicAck(42L, false);
    }

    @Test
    void retryableOutcomeIsPublishedToRetryRouteThenAcknowledged() throws Exception {
        JobMessage message = message();
        prepareMessage(43L);
        when(worker.execute(message)).thenReturn(JobProcessingOutcome.RETRYABLE_FAILURE);

        consume(message);

        verify(publisher).publishRetry(message);
        verify(channel).basicAck(43L, false);
    }

    @Test
    void permanentOutcomeIsPublishedToDeadLetterRouteThenAcknowledged() throws Exception {
        JobMessage message = message();
        prepareMessage(44L);
        when(worker.execute(message)).thenReturn(JobProcessingOutcome.PERMANENT_FAILURE);

        consume(message);

        verify(publisher).publishDeadLetter(message);
        verify(channel).basicAck(44L, false);
    }

    @Test
    void staleOutcomeIsAcknowledgedWithoutRouting() throws Exception {
        JobMessage message = message();
        prepareMessage(45L);
        when(worker.execute(message)).thenReturn(JobProcessingOutcome.STALE);

        consume(message);

        verify(channel).basicAck(45L, false);
        verify(publisher, never()).publishRetry(message);
        verify(publisher, never()).publishDeadLetter(message);
    }

    @Test
    void redisUnavailableIsDeadLetteredAndAcknowledged() throws Exception {
        JobMessage message = message();
        prepareMessage(46L);
        when(worker.execute(message)).thenReturn(JobProcessingOutcome.REDIS_UNAVAILABLE);

        consume(message);

        verify(publisher).publishDeadLetter(message);
        verify(channel).basicAck(46L, false);
    }

    private JobMessage message() {
        return new JobMessage(UUID.randomUUID(), "ECHO", "payload", UUID.randomUUID());
    }

    private void prepareMessage(long deliveryTag) {
        org.springframework.amqp.core.MessageProperties properties = new org.springframework.amqp.core.MessageProperties();
        properties.setDeliveryTag(deliveryTag);
        when(rawMessage.getMessageProperties()).thenReturn(properties);
    }

    private void consume(JobMessage message) {
        try {
            consumer.consume(message, channel, rawMessage);
        } catch (java.io.IOException exception) {
            throw new AssertionError(exception);
        }
    }
}
