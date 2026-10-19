package com.securevault.common;

import javax.sql.DataSource;
import org.flywaydb.core.Flyway;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.stereotype.Component;

/** Explicitly applies pending database migrations on the application's configured datasource. */
@Component
public class FlywayMigrationRunner implements ApplicationRunner {

    private final ObjectProvider<DataSource> dataSources;

    public FlywayMigrationRunner(ObjectProvider<DataSource> dataSources) {
        this.dataSources = dataSources;
    }

    @Override
    public void run(ApplicationArguments args) {
        DataSource dataSource = dataSources.getIfAvailable();
        if (dataSource == null) return;
        Flyway.configure()
                .dataSource(dataSource)
                .baselineOnMigrate(true)
                .baselineVersion("1")
                .locations("classpath:db/migration")
                .load()
                .migrate();
    }
}
