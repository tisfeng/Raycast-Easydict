/* Copyright (c) 2022~present by tisfeng, maxchang3, All Rights Reserved. */

import { readFile } from "node:fs/promises";
import { dirname } from "node:path";

import {
  Action,
  ActionPanel,
  confirmAlert,
  Detail,
  Form,
  Icon,
  Keyboard,
  showToast,
  Toast,
  useNavigation,
} from "@raycast/api";
import { showFailureToast } from "@raycast/utils";
import { useState } from "react";

import { decodeFavoriteStorage, exportFavoriteWords, type FavoriteStorageState } from "./repository";

type RecoveryState = Exclude<FavoriteStorageState, { kind: "ready" }>;

export function FavoriteStorageRecovery({
  state,
  onReload,
  onRestore,
}: {
  state: RecoveryState;
  onReload: () => Promise<unknown>;
  onRestore: (path: string) => Promise<string | undefined>;
}) {
  const [backupPath, setBackupPath] = useState<string>();
  const exportRaw = async () => {
    try {
      const path = await exportFavoriteWords();
      setBackupPath(path);
      await showToast({ style: Toast.Style.Success, title: "Favorites Backup Saved", message: path });
    } catch (error) {
      await showFailureToast(error, { title: "Failed to Export Favorites" });
    }
  };

  return (
    <Detail
      markdown={`# Favorites Could Not Be Loaded\n\n${state.message}\n\n${state.kind === "unsupported" ? "Use a compatible version of Easydict to open this data. You can export the original data below." : state.kind === "error" ? "Retry loading favorites after the storage error has been resolved. No saved data has been changed." : "You can retry loading or export the original data. To restore a valid backup, choose its JSON file; your current data will be backed up before replacement."}`}
      actions={
        <ActionPanel>
          {"raw" in state && <Action title="Export Original Data" icon={Icon.Download} onAction={exportRaw} />}
          {state.kind === "invalid" && (
            <Action.Push
              title="Restore from Backup"
              icon={Icon.ArrowClockwise}
              target={<RestoreFavoriteBackup onRestore={onRestore} />}
            />
          )}
          <Action
            title="Reload Favorites"
            icon={Icon.ArrowClockwise}
            shortcut={Keyboard.Shortcut.Common.Refresh}
            onAction={async () => {
              await onReload();
            }}
          />
          {backupPath && <Action.Open title="Open Backup Folder" target={dirname(backupPath)} />}
        </ActionPanel>
      }
    />
  );
}

function RestoreFavoriteBackup({ onRestore }: { onRestore: (path: string) => Promise<string | undefined> }) {
  const { pop } = useNavigation();
  const [files, setFiles] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>();
  const submit = async () => {
    const path = files[0];
    if (!path) {
      setError("Choose a favorites backup JSON file.");
      return;
    }
    setIsLoading(true);
    try {
      const decoded = decodeFavoriteStorage(await readFile(path, "utf8"));
      if (decoded.kind !== "ready")
        throw new Error("The selected file is not a valid favorites backup for this version.");
      if (
        !(await confirmAlert({
          title: `Restore ${decoded.favorites.length} Favorites?`,
          message: "Your current saved data will be backed up locally before it is replaced.",
          primaryAction: { title: "Restore Backup" },
        }))
      )
        return;
      const backup = await onRestore(path);
      await showToast({
        style: Toast.Style.Success,
        title: "Favorites Restored",
        message: backup ? `Previous data saved to ${backup}` : undefined,
      });
      pop();
    } catch (error) {
      await showFailureToast(error, { title: "Failed to Restore Favorites" });
    } finally {
      setIsLoading(false);
    }
  };
  return (
    <Form
      navigationTitle="Restore Favorites"
      isLoading={isLoading}
      actions={
        <ActionPanel>
          <Action.SubmitForm title="Restore Backup" icon={Icon.ArrowClockwise} onSubmit={submit} />
        </ActionPanel>
      }
    >
      <Form.FilePicker
        id="backup"
        title="Backup File"
        allowMultipleSelection={false}
        canChooseDirectories={false}
        value={files}
        error={error}
        onChange={(files) => {
          setFiles(files);
          setError(undefined);
        }}
      />
    </Form>
  );
}
