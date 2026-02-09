-- CreateIndex
CREATE INDEX `Product_status_idx` ON `Product`(`status`);

-- CreateIndex
CREATE INDEX `Product_category_idx` ON `Product`(`category`);

-- CreateIndex
CREATE INDEX `Product_createdAt_idx` ON `Product`(`createdAt`);

-- CreateIndex
CREATE INDEX `Product_updatedAt_idx` ON `Product`(`updatedAt`);

-- CreateIndex
CREATE INDEX `User_role_idx` ON `User`(`role`);

-- CreateIndex
CREATE INDEX `User_createdAt_idx` ON `User`(`createdAt`);

-- RenameIndex
ALTER TABLE `Product` RENAME INDEX `Product_updatedById_fkey` TO `Product_updatedById_idx`;
