# The image, multi stage, with the heap sized for the container rather than the host.
#
# **Not built**: there is no Docker on the machine this was written on, and
# spring/NOT_BUILT.md lists everything else in that category. The reasoning is the
# deliverable and it is the same reasoning level 17 measured: 88.6 MB and 3,277 files
# of test tooling shipped for nothing when the stages are not separated.

# ------------------------------------------------------------------ 1. build
FROM maven:3.9.9-eclipse-temurin-21 AS build
WORKDIR /build

# Dependencies first, source second, for the same reason as level 17: a one line
# change must not re-download Maven Central. `go-offline` is imperfect and it still
# turns a two minute resolve into a cached layer.
COPY spring/pom.xml ./pom.xml
RUN mvn -B dependency:go-offline

COPY src ./src
COPY spring/src ./spring-src
RUN mvn -B -DskipTests package && \
    mv target/payments-api-0.1.0.jar /build/app.jar

# --------------------------------------------------------------- 2. runtime
# A JRE rather than a JDK: the compiler is 150 MB that never runs in production.
FROM eclipse-temurin:21.0.4_7-jre-alpine AS runtime

# A user that is not root, created before anything is copied.
RUN addgroup -S -g 10001 payments && adduser -S -u 10001 -G payments payments

WORKDIR /app
COPY --from=build --chown=payments:payments /build/app.jar ./app.jar
USER payments
EXPOSE 8000

# The heap, sized as a share of the *container* limit.
#
# This is the line that causes the mystery restart. A JVM before 10 defaulted to a
# quarter of the *host's* memory, so a container limited to 512 MB on a 64 GB host
# would size its heap at 16 GB, allocate past the limit, and be killed by the
# kernel with exit code 137 and no stack trace, no log line and no clue.
#
# `MaxRAMPercentage` reads the container limit, which is what makes it correct. 75%
# leaves room for the metaspace, the thread stacks, the code cache and the direct
# buffers, all of which are outside the heap and all of which count towards the
# limit.
ENV JAVA_TOOL_OPTIONS="\
  -XX:MaxRAMPercentage=75 \
  -XX:+UseSerialGC \
  -XX:+ExitOnOutOfMemoryError \
  -Djava.security.egd=file:/dev/./urandom"

# A readiness probe that tolerates JVM start up, which is the other half of the
# level 18 lesson. Measured in finquest.bench.WarmUp: the handler's p99 improves
# 34.6 times over the first second and a half as the JIT compiles, so a probe with a
# one second start period declares the instance unhealthy while it is merely cold,
# and a canary window shorter than that compares a warm old version with a cold new
# one.
HEALTHCHECK --interval=10s --timeout=2s --start-period=30s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8000/actuator/health/readiness || exit 1

# Exec form, so the JVM is pid 1 and gets SIGTERM directly. With `server.shutdown:
# graceful` that begins the drain; through a shell it does not arrive at all.
ENTRYPOINT ["java", "-jar", "/app/app.jar"]
