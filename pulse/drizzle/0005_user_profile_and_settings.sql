CREATE TABLE `user_settings` (
	`user_id` text PRIMARY KEY NOT NULL,
	`notify_on_task_assigned` integer DEFAULT true NOT NULL,
	`notify_on_task_comment` integer DEFAULT true NOT NULL,
	`notify_on_task_status_change` integer DEFAULT true NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `users` ADD `display_name` text;