import { integer, sqliteTable, text } from "drizzle-orm/sqlite-core";
export const buffetState=sqliteTable("buffet_state",{id:integer("id").primaryKey(),payload:text("payload").notNull(),updatedAt:integer("updated_at").notNull()});
