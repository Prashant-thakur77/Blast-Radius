PRAGMA foreign_keys=OFF;--> statement-breakpoint
CREATE TABLE `__new_activity_events` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`project_id` text NOT NULL,
	`task_id` text,
	`actor_user_id` text NOT NULL,
	`type` text NOT NULL,
	`payload` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`project_id`) REFERENCES `projects`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`actor_user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_activity_events`("id", "workspace_id", "project_id", "task_id", "actor_user_id", "type", "payload", "created_at") SELECT "id", "workspace_id", "project_id", "task_id", "actor_user_id", "type", "payload", "created_at" FROM `activity_events`;--> statement-breakpoint
DROP TABLE `activity_events`;--> statement-breakpoint
ALTER TABLE `__new_activity_events` RENAME TO `activity_events`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `activity_task_idx` ON `activity_events` (`task_id`);--> statement-breakpoint
CREATE INDEX `activity_project_created_idx` ON `activity_events` (`project_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `__new_projects` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`slug` text NOT NULL,
	`description` text,
	`status` text DEFAULT 'planning' NOT NULL,
	`icon` text DEFAULT 'folder-kanban' NOT NULL,
	`created_by` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_projects`("id", "workspace_id", "name", "slug", "description", "status", "icon", "created_by", "created_at", "updated_at") SELECT "id", "workspace_id", "name", "slug", "description", "status", "icon", "created_by", "created_at", "updated_at" FROM `projects`;--> statement-breakpoint
DROP TABLE `projects`;--> statement-breakpoint
ALTER TABLE `__new_projects` RENAME TO `projects`;--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_project_slug_idx` ON `projects` (`workspace_id`,`slug`);--> statement-breakpoint
CREATE TABLE `__new_workspace_members` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`user_id` text NOT NULL,
	`role` text NOT NULL,
	`joined_at` integer NOT NULL,
	FOREIGN KEY (`workspace_id`) REFERENCES `workspaces`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
INSERT INTO `__new_workspace_members`("id", "workspace_id", "user_id", "role", "joined_at") SELECT "id", "workspace_id", "user_id", "role", "joined_at" FROM `workspace_members`;--> statement-breakpoint
DROP TABLE `workspace_members`;--> statement-breakpoint
ALTER TABLE `__new_workspace_members` RENAME TO `workspace_members`;--> statement-breakpoint
CREATE UNIQUE INDEX `workspace_user_idx` ON `workspace_members` (`workspace_id`,`user_id`);