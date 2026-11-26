# ---- build ----
FROM eclipse-temurin:17-jdk AS build
WORKDIR /src
COPY .mvn .mvn
COPY mvnw pom.xml ./
RUN chmod +x mvnw && ./mvnw -B -q dependency:go-offline
COPY src src
RUN ./mvnw -B -q package -DskipTests && cp target/travelmate-api-*.jar /src/app.jar

# ---- run ----
FROM eclipse-temurin:17-jre
RUN useradd --system --uid 10001 travelmate
WORKDIR /app
COPY --from=build /src/app.jar app.jar
USER travelmate
EXPOSE 8080
ENV SPRING_PROFILES_ACTIVE=postgres \
    JAVA_OPTS="-XX:MaxRAMPercentage=75"
# Health probes for orchestrators: /actuator/health/liveness and /actuator/health/readiness
ENTRYPOINT ["sh", "-c", "exec java $JAVA_OPTS -jar /app/app.jar"]
