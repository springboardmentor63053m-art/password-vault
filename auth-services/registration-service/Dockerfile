FROM maven:3.9.9-eclipse-temurin-17 AS build
WORKDIR /app
COPY pom.xml .
COPY src ./src
RUN mvn -q package

FROM eclipse-temurin:17-jre
WORKDIR /app
COPY --from=build /app/target/registration-service-0.0.1-SNAPSHOT.jar app.jar
USER 10001:10001
EXPOSE 8081
ENTRYPOINT ["java", "-jar", "app.jar"]
