const fs = require('fs');
let code = fs.readFileSync('src/features/SettingsView.tsx', 'utf8');

// handleRemoveGodown
code = code.replace(
`    const oldName = configuredGodowns[idx];
    if (!window.confirm(\`Remove godown "\${oldName}"?\`)) return;
    const updated = configuredGodowns.filter((_, i) => i !== idx);
    setConfiguredGodowns(updated);

    if (mainGodowns?.includes(oldName)) {
      const { setMainGodowns } = useAppStore.getState();
      setMainGodowns(mainGodowns.filter((g: string) => g !== oldName));
    }`,
`    const oldName = configuredGodowns[idx];
    confirmAction('Remove Godown', \`Remove godown "\${oldName}"?\`, () => {
      const updated = configuredGodowns.filter((_, i) => i !== idx);
      setConfiguredGodowns(updated);

      if (mainGodowns?.includes(oldName)) {
        const { setMainGodowns } = useAppStore.getState();
        setMainGodowns(mainGodowns.filter((g: string) => g !== oldName));
      }
    });`
);

// handleRemoveSupplier
code = code.replace(
`    if (!window.confirm(\`Remove supplier "\${name}"?\`)) return;
    removeSupplier(name);
    logActivity('Delete Supplier', \`Deleted supplier: \${name}\`);`,
`    confirmAction('Remove Supplier', \`Remove supplier "\${name}"?\`, () => {
      removeSupplier(name);
      logActivity('Delete Supplier', \`Deleted supplier: \${name}\`);
    });`
);

// handleClearProductMaster
code = code.replace(
`    if (!window.confirm('Clear Product Master Cache?\\nThe system will forget all assigned godowns and will re-learn them from the next PDF.')) return;
    clearProductMaster();
    logActivity('Clear Product Master', 'Cleared the entire product godown/supplier cache.');`,
`    confirmAction('Clear Product Master', 'Clear Product Master Cache?\\nThe system will forget all assigned godowns and will re-learn them from the next PDF.', () => {
      clearProductMaster();
      logActivity('Clear Product Master', 'Cleared the entire product godown/supplier cache.');
    });`
);

// handleDeleteSheet
code = code.replace(
`    if (!window.confirm(\`Delete sheet \${dateStr} for ALL users?\\nCannot undo.\`)) return;
    
    const newReports = { ...dailyReports };
    delete newReports[dateStr];
    useAppStore.setState({ dailyReports: newReports });
    await cloudDeleteDateReport(dateStr);
    logActivity('Delete Single Sheet', \`Deleted daybook sheet for date: \${dateStr}\`);`,
`    confirmAction('Delete Sheet', \`Delete sheet \${dateStr} for ALL users?\\nCannot undo.\`, async () => {
      const newReports = { ...dailyReports };
      delete newReports[dateStr];
      useAppStore.setState({ dailyReports: newReports });
      await cloudDeleteDateReport(dateStr);
      logActivity('Delete Single Sheet', \`Deleted daybook sheet for date: \${dateStr}\`);
    });`
);

// handleDeleteAllSheets
code = code.replace(
`    if (!window.confirm('Delete EVERY sheet for ALL users?\\nFirst confirm.')) return;
    if (!window.confirm('Really wipe the full shared daybook?\\nLast chance  cannot undo.')) return;
    
    for (const dateStr of dates) {
      await cloudDeleteDateReport(dateStr);
    }
    useAppStore.setState({ dailyReports: {} });
    alert('Daybook completely wiped.');
    logActivity('Delete All Sheets', 'Wiped ALL daybook sheets.');`,
`    confirmAction('Delete ALL Sheets', 'Delete EVERY sheet for ALL users?\\nReally wipe the full shared daybook?\\nLast chance cannot undo.', async () => {
      for (const dateStr of dates) {
        await cloudDeleteDateReport(dateStr);
      }
      useAppStore.setState({ dailyReports: {} });
      alert('Daybook completely wiped.');
      logActivity('Delete All Sheets', 'Wiped ALL daybook sheets.');
    });`
);

// handleToggleUserStatus
code = code.replace(
`    const action = currentDisabled ? 'Enable' : 'Disable';
    if (!window.confirm(\`\${action} this user?\`)) return;
    const ok = await toggleProfileStatus(targetId, !currentDisabled);
    if (ok) {
      logActivity('Change Status', \`\${!currentDisabled ? 'Suspended' : 'Enabled'} user \${targetId}\`);
    }`,
`    const action = currentDisabled ? 'Enable' : 'Disable';
    confirmAction(\`\${action} User\`, \`\${action} this user?\`, async () => {
      const ok = await toggleProfileStatus(targetId, !currentDisabled);
      if (ok) {
        logActivity('Change Status', \`\${!currentDisabled ? 'Suspended' : 'Enabled'} user \${targetId}\`);
      }
    });`
);

// handleUpdateUserRole
code = code.replace(
`    const newRole = currentRole === 'admin' ? 'worker' : 'admin';
    if (!window.confirm(\`Change role to \${newRole.toUpperCase()}?\`)) return;
    const ok = await updateProfileRole(targetId, newRole);
    if (ok) {
      logActivity('Change Role', \`Changed role of user \${targetId} to \${newRole}\`);
    }`,
`    const newRole = currentRole === 'admin' ? 'worker' : 'admin';
    confirmAction('Change Role', \`Change role to \${newRole.toUpperCase()}?\`, async () => {
      const ok = await updateProfileRole(targetId, newRole);
      if (ok) {
        logActivity('Change Role', \`Changed role of user \${targetId} to \${newRole}\`);
      }
    });`
);

// handleDisableAllOtherUsers
code = code.replace(
`    if (!window.confirm('Disable all other users? This will block access for everyone except you.')) return;
    for (const u of configuredUsers) {
      if (u.id !== user?.uid && !u.is_disabled) {
        await toggleProfileStatus(u.id, true);
      }
    }`,
`    confirmAction('Disable All Others', 'Disable all other users? This will block access for everyone except you.', async () => {
      for (const u of configuredUsers) {
        if (u.id !== user?.uid && !u.is_disabled) {
          await toggleProfileStatus(u.id, true);
        }
      }
    });`
);

// handleMasterWipe
code = code.replace(
`    if (!window.confirm('🚨 WARNING 🚨\\nYou are about to execute a MASTER WIPE.\\n\\nThis will delete:\\n- All Daybook Sheets\\n- All Product Memory\\n- All Godowns\\n- All Aliases\\n- All Suppliers\\n\\nContinue?')) return;
    if (!window.confirm('Are you ABSOLUTELY SURE? There is no undo!')) return;`,
`    confirmAction('Master Wipe', '🚨 WARNING 🚨\\nYou are about to execute a MASTER WIPE.\\n\\nThis will delete:\\n- All Daybook Sheets\\n- All Product Memory\\n- All Godowns\\n- All Aliases\\n- All Suppliers\\n\\nAre you ABSOLUTELY SURE? There is no undo!', async () => {`
);
code = code.replace(
`    alert('Master wipe successful. Returning to login...');
    logout();
  };`,
`    alert('Master wipe successful. Returning to login...');
    logout();
    });
  };`
);

// logout
code = code.replace(
`              if (window.confirm('Are you sure you want to sign out?')) {
                logout();
              }`,
`              confirmAction('Sign Out', 'Are you sure you want to sign out?', () => {
                logout();
              });`
);

// Wipe selected data
code = code.replace(
`                  if (!window.confirm('Wipe selected data?')) return;

                  if (selectedGodownsToWipe.length > 0) {`,
`                  confirmAction('Selective Wipe', 'Wipe selected data?', async () => {

                  if (selectedGodownsToWipe.length > 0) {`
);
code = code.replace(
`                  setWipeProductMaster(false);
                  setSuspendOtherUsers(false);
                  alert('Selected data wiped.');
                  logActivity('Selective Wipe', \`Selective wipe executed. Godowns: \${selectedGodownsToWipe.length}, Suppliers: \${selectedSuppliersToWipe.length}, Dates: \${selectedDatesToWipe.length}, PM: \${wipeProductMaster}, Users Suspended: \${suspendOtherUsers}\`);
                }}
                disabled={!(selectedGodownsToWipe.length > 0 || selectedSuppliersToWipe.length > 0 || selectedDatesToWipe.length > 0 || wipeProductMaster || suspendOtherUsers)}`,
`                  setWipeProductMaster(false);
                  setSuspendOtherUsers(false);
                  alert('Selected data wiped.');
                  logActivity('Selective Wipe', \`Selective wipe executed. Godowns: \${selectedGodownsToWipe.length}, Suppliers: \${selectedSuppliersToWipe.length}, Dates: \${selectedDatesToWipe.length}, PM: \${wipeProductMaster}, Users Suspended: \${suspendOtherUsers}\`);
                  });
                }}
                disabled={!(selectedGodownsToWipe.length > 0 || selectedSuppliersToWipe.length > 0 || selectedDatesToWipe.length > 0 || wipeProductMaster || suspendOtherUsers)}`
);

// Insert ConfirmDialog renderer at bottom of view
code = code.replace(
`    </div>
  );
};`,
`      <ConfirmDialog 
        open={confirmState.open}
        title={confirmState.title}
        description={confirmState.description}
        isDestructive={confirmState.isDestructive}
        onConfirm={() => {
          setConfirmState(prev => ({ ...prev, open: false }));
          confirmState.onConfirm();
        }}
        onCancel={() => setConfirmState(prev => ({ ...prev, open: false }))}
      />
    </div>
  );
};`
);

fs.writeFileSync('src/features/SettingsView.tsx', code);
console.log('Done refactoring SettingsView.tsx');
