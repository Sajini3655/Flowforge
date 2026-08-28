package com.flowforge.api;

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
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ApiDefinitionController.class)
@Import({GlobalExceptionHandler.class, SecurityConfig.class, JwtAuthenticationFilter.class, JwtTestConfiguration.class})
@WithMockUser(roles = "ADMIN")
class ApiDefinitionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private ApiDefinitionService service;

    @MockBean
    private UserRepository userRepository;


    @Test
    void createWithValidRequestReturnsCreatedApi() throws Exception {
        ApiDefinition api = new ApiDefinition();
        api.setName("Report API");
        api.setDescription("Generates reports");
        api.setVersion("v1");
        api.setBasePath("/reports");
        api.setBackendUrl("http://reports");
        when(service.create(any(ApiDefinitionRequest.class))).thenReturn(api);

        mockMvc.perform(post("/api/apis")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "Report API",
                                  "description": "Generates reports",
                                  "version": "v1",
                                  "basePath": "/reports",
                                  "backendUrl": "http://reports"
                                }
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.name").value("Report API"))
                .andExpect(jsonPath("$.version").value("v1"))
                .andExpect(jsonPath("$.basePath").value("/reports"))
                .andExpect(jsonPath("$.backendUrl").value("http://reports"));

        verify(service).create(any(ApiDefinitionRequest.class));
    }

    @Test
    void createWithMissingRequiredFieldReturnsBadRequest() throws Exception {
        mockMvc.perform(post("/api/apis")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""
                                {
                                  "name": "",
                                  "version": "v1",
                                  "basePath": "/reports",
                                  "backendUrl": "http://reports"
                                }
                                """))
                .andExpect(status().isBadRequest());

        verify(service, never()).create(any(ApiDefinitionRequest.class));
    }

    @Test
    void findAllReturnsApiList() throws Exception {
        ApiDefinition api = new ApiDefinition();
        api.setName("Report API");
        api.setVersion("v1");
        api.setBasePath("/reports");
        api.setBackendUrl("http://reports");
        when(service.findAll()).thenReturn(List.of(api));

        mockMvc.perform(get("/api/apis"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].name").value("Report API"))
                .andExpect(jsonPath("$[0].status").value("DRAFT"));

        verify(service).findAll();
    }

      @Test
      void findByIdReturnsApi() throws Exception {
        ApiDefinition api = new ApiDefinition();
        ReflectionTestUtils.setField(api, "id", 7L);
        api.setName("Report API");
        api.setVersion("v1");
        api.setBasePath("/reports");
        api.setBackendUrl("http://reports");
        when(service.findById(7L)).thenReturn(api);

        mockMvc.perform(get("/api/apis/7"))
            .andExpect(status().isOk())
            .andExpect(jsonPath("$.id").value(7))
            .andExpect(jsonPath("$.name").value("Report API"));

        verify(service).findById(7L);
      }

      @Test
      void findByIdWhenApiDoesNotExistReturnsNotFound() throws Exception {
        when(service.findById(99L))
            .thenThrow(new ResourceNotFoundException("API not found: 99"));

        mockMvc.perform(get("/api/apis/99"))
            .andExpect(status().isNotFound())
            .andExpect(jsonPath("$.message").value("API not found: 99"));
      }
}
