module.exports = {
    apps: [
        {
            name: 'copy-trading-supervisor',
            script: 'npx',
            args: 'tsx scripts/copy-trading-supervisor.ts',
            cwd: './frontend',
            interpreter: 'none',
            env: {
                NODE_ENV: 'production',
            },
            // Restart settings
            autorestart: true,
            max_restarts: 10,
            restart_delay: 5000,
            // Logging
            log_date_format: 'YYYY-MM-DD HH:mm:ss',
            error_file: './logs/supervisor-error.log',
            out_file: './logs/supervisor-out.log',
            merge_logs: true,
            // Memory management
            max_memory_restart: '500M',
        }
    ]
};
