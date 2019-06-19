import { PgDb } from 'pogi'
import { appConfig } from './config/app-config'

const dbOptions = {
    connectionString: appConfig.dbConnectionString,
    logger: console
}

export const connectDb = () => PgDb.connect(dbOptions)
export const getDb = () => PgDb.getInstance(dbOptions)
