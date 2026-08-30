plugins {
	java
	id("org.springframework.boot") version "4.1.1"
	id("io.spring.dependency-management") version "1.1.7"
}

group = "com.aitrading"
version = "0.0.1-SNAPSHOT"

dependencyLocking { lockAllConfigurations() }

java {
	toolchain {
		languageVersion = JavaLanguageVersion.of(21)
	}
}

repositories {
	mavenCentral()
}

dependencies {
	implementation("org.springframework.boot:spring-boot-starter-flyway")
	implementation("org.springframework.boot:spring-boot-starter-jdbc")
	implementation("org.springframework.boot:spring-boot-starter-security")
	implementation("org.springframework.boot:spring-boot-starter-validation")
	implementation("org.springframework.boot:spring-boot-starter-webmvc")
	implementation("org.flywaydb:flyway-database-postgresql")
	runtimeOnly("org.postgresql:postgresql")
	testImplementation("org.springframework.boot:spring-boot-starter-flyway-test")
	testImplementation("org.springframework.boot:spring-boot-starter-jdbc-test")
	testImplementation("org.springframework.boot:spring-boot-starter-security-test")
	testImplementation("org.springframework.boot:spring-boot-starter-validation-test")
	testImplementation("org.springframework.boot:spring-boot-starter-webmvc-test")
	testRuntimeOnly("org.junit.platform:junit-platform-launcher")
}

tasks.withType<Test> {
	useJUnitPlatform()
    systemProperty("java.net.preferIPv4Stack", "true")
}

tasks.register("dependencyInventory") {
    doLast {
        val entries = listOf("compileClasspath", "runtimeClasspath", "testCompileClasspath", "testRuntimeClasspath")
            .flatMap { configurations[it].resolvedConfiguration.resolvedArtifacts }
            .map { "${it.moduleVersion.id.group}:${it.name}:${it.moduleVersion.id.version}" }
            .distinct().sorted()
        val target = layout.buildDirectory.file("reports/dependencies.txt").get().asFile
        target.parentFile.mkdirs()
        target.writeText(entries.joinToString("\n", postfix = "\n"))
    }
}
