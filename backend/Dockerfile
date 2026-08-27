FROM maven:3.9.11-eclipse-temurin-21 AS build

WORKDIR /workspace
COPY pom.xml .
COPY src ./src
RUN mvn -B -ntp clean package -DskipTests

FROM eclipse-temurin:21-jre-jammy

RUN apt-get update \
    && apt-get install -y --no-install-recommends curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd --system flowforge \
    && useradd --system --gid flowforge --home-dir /app --shell /usr/sbin/nologin flowforge

WORKDIR /app
COPY --from=build /workspace/target/flowforge-backend-0.0.1-SNAPSHOT.jar /app/app.jar
RUN chown -R flowforge:flowforge /app

USER flowforge
EXPOSE 8080
ENV JAVA_TOOL_OPTIONS="-XX:MaxRAMPercentage=75.0 -XX:+UseContainerSupport"

HEALTHCHECK --interval=30s --timeout=5s --start-period=90s --retries=5 \
    CMD curl --fail --silent http://localhost:8080/api/health/live || exit 1

ENTRYPOINT ["java", "-jar", "/app/app.jar"]