FROM wso2/wso2am:4.7.0
COPY custom-key-manager/src/main/java/com/flowforge/wso2/FlowForgeKeyValidationHandler.java /tmp/FlowForgeKeyValidationHandler.java
RUN mkdir -p /tmp/classes \
    && javac -cp "$(find /home/wso2carbon/wso2am-4.7.0/repository/components/plugins -name '*.jar' -printf '%p:')" \
       -d /tmp/classes /tmp/FlowForgeKeyValidationHandler.java \
     && jar --create --file /home/wso2carbon/wso2am-4.7.0/repository/components/lib/flowforge-wso2-key-manager.jar \
         -C /tmp/classes com/flowforge/wso2
RUN sed -i 's/^#enable_outbound_auth_header = false/enable_outbound_auth_header = true/' \
        /home/wso2carbon/wso2am-4.7.0/repository/conf/deployment.toml \
    && sed -i 's/^#auth_header = "Authorization"/auth_header = "Authorization"/' \
        /home/wso2carbon/wso2am-4.7.0/repository/conf/deployment.toml \
    && printf '\n[[apim.jwt.issuer]]\nname = "https://auth.flowforge.local"\n[apim.jwt.issuer.jwks]\nurl = "http://backend:8080/api/.well-known/jwks.json"\n' \
        >> /home/wso2carbon/wso2am-4.7.0/repository/conf/deployment.toml
