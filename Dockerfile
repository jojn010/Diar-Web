FROM docker.io/library/eclipse-temurin:25-jdk AS build
WORKDIR /source
COPY . .
RUN chmod +x gradlew && ./gradlew test bootJar --no-daemon

FROM docker.io/library/eclipse-temurin:25-jre
WORKDIR /app
RUN groupadd --system diar && useradd --system --gid diar diar
COPY --from=build --chown=diar:diar /source/build/libs/diar-web-1.0.0.jar app.jar
USER diar
ENV PORT=8080 BIND_ADDRESS=0.0.0.0 COOKIE_SECURE=true
EXPOSE 8080
ENTRYPOINT ["java","-XX:MaxRAMPercentage=70","-jar","app.jar"]
