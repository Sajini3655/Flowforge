package com.flowforge.job;

import com.flowforge.common.GlobalExceptionHandler;
import com.flowforge.common.ResourceNotFoundException;
import com.flowforge.security.JwtAuthenticationFilter;
import com.flowforge.security.JwtService;
import com.flowforge.security.JwtTestConfiguration;
import com.flowforge.security.SecurityConfig;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.http.MediaType;
import org.springframework.security.test.context.support.WithMockUser;
import com.flowforge.user.UserRepository;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;
import java.util.UUID;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(JobController.class)
@Import({GlobalExceptionHandler.class, SecurityConfig.class, JwtAuthenticationFilter.class, JwtTestConfiguration.class})
@WithMockUser(roles = "USER")
class JobControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private JobService service;

    @MockBean
    private UserRepository userRepository;


    @Test
    void createWithValidRequestReturnsCreatedJob() throws Exception {
        Job job = new Job();
        UUID jobId = UUID.randomUUID();
        ReflectionTestUtils.setField(job, "id", jobId);
        job.setType("REPORT");
        job.setRequestPayload("{\"projectId\":123}");
        when(service.create(any(JobRequest.class))).thenReturn(job);

        mockMvc.perform(post("/api/jobs")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "type": "REPORT",
                                  "requestPayload": "{\\"projectId\\":123}"
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").value(jobId.toString()))
                .andExpect(jsonPath("$.type").value("REPORT"))
                .andExpect(jsonPath("$.status").value("QUEUED"));

        verify(service).create(any(JobRequest.class));
    }

    @Test
    void createWithMissingRequiredFieldReturnsBadRequest() throws Exception {
        mockMvc.perform(post("/api/jobs")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "type": "",
                                  "requestPayload": "payload"
                                }
                                """))
                .andExpect(status().isBadRequest());

        verify(service, never()).create(any(JobRequest.class));
    }

    @Test
    void findAllReturnsJobList() throws Exception {
        Job job = new Job();
        job.setType("REPORT");
        job.setRequestPayload("payload");
        when(service.findAll()).thenReturn(List.of(job));

        mockMvc.perform(get("/api/jobs"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].type").value("REPORT"))
                .andExpect(jsonPath("$[0].status").value("QUEUED"));

        verify(service).findAll();
    }

    @Test
    void findByIdWhenJobExistsReturnsJob() throws Exception {
        UUID jobId = UUID.randomUUID();
        Job job = new Job();
        ReflectionTestUtils.setField(job, "id", jobId);
        job.setType("REPORT");
        job.setRequestPayload("payload");
        when(service.findById(jobId)).thenReturn(job);

        mockMvc.perform(get("/api/jobs/{id}", jobId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(jobId.toString()));

        verify(service).findById(eq(jobId));
    }

    @Test
    void findByIdWhenJobDoesNotExistReturnsNotFound() throws Exception {
        UUID jobId = UUID.randomUUID();
        when(service.findById(jobId))
                .thenThrow(new ResourceNotFoundException("Job not found: " + jobId));

        mockMvc.perform(get("/api/jobs/{id}", jobId))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.message").value("Job not found: " + jobId));

        verify(service).findById(eq(jobId));
    }

    @Test
    void retryWhenJobExistsReturnsRetriedJob() throws Exception {
        UUID jobId = UUID.randomUUID();
        Job job = new Job();
        ReflectionTestUtils.setField(job, "id", jobId);
        job.setType("REPORT");
        job.setStatus(JobStatus.QUEUED);
        when(service.retry(jobId)).thenReturn(job);

        mockMvc.perform(post("/api/jobs/{id}/retry", jobId))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(jobId.toString()))
                .andExpect(jsonPath("$.status").value("QUEUED"));

        verify(service).retry(eq(jobId));
    }
}
