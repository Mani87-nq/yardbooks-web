'use client';

import React, { useState } from 'react';
import { Modal, ModalBody, ModalFooter, Button, Input } from '@/components/ui';
import { usePosStore } from '@/store/posStore';
import { setAssignedTerminalId } from '@/lib/terminalId';
import {
  ComputerDesktopIcon,
  PlusIcon,
  CheckCircleIcon,
  MapPinIcon,
  SignalIcon,
} from '@heroicons/react/24/outline';

interface TerminalSelectorProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (terminalId: string) => void;
  currentTerminalId?: string | null;
}

export function TerminalSelector({ isOpen, onClose, onSelect, currentTerminalId }: TerminalSelectorProps) {
  const terminals = usePosStore((s) => s.terminals);
  const addTerminal = usePosStore((s) => s.addTerminal);

  const [newName, setNewName] = useState('');
  const [newLocation, setNewLocation] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);

  const activeTerminals = terminals.filter((t) => t.isActive);
  const hasTerminals = activeTerminals.length > 0;

  const handleSelect = (terminalId: string) => {
    setAssignedTerminalId(terminalId);
    onSelect(terminalId);
  };

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;

    const terminal = addTerminal({
      name,
      location: newLocation.trim() || undefined,
      isActive: true,
      isOnline: true,
      defaultPaymentMethods: ['cash', 'card_visa', 'card_mastercard'],
      allowNegativeInventory: false,
      requireCustomer: false,
      allowDiscounts: true,
      maxDiscountPercent: 20,
      barcodeScanner: false,
    });

    setNewName('');
    setNewLocation('');
    setShowCreateForm(false);

    // Auto-select the newly created terminal
    handleSelect(terminal.id);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={currentTerminalId ? onClose : () => {}}
      title="Select POS Terminal"
      size="md"
    >
      <ModalBody>
        <div className="space-y-4">
          {/* Explanation */}
          <div className="bg-blue-50 dark:bg-blue-900/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
            <p className="text-sm text-blue-700 dark:text-blue-300">
              <ComputerDesktopIcon className="w-4 h-4 inline mr-1" />
              Assign a POS terminal to this device. This setting is saved and will be remembered on future visits.
            </p>
          </div>

          {/* Terminal List */}
          {hasTerminals && (
            <div className="space-y-2">
              <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Available Terminals
              </h4>
              {activeTerminals.map((terminal) => {
                const isSelected = terminal.id === currentTerminalId;
                const hasActiveSession = !!terminal.currentSessionId;

                return (
                  <button
                    key={terminal.id}
                    onClick={() => handleSelect(terminal.id)}
                    className={`w-full flex items-center justify-between p-4 rounded-lg border transition-all text-left ${
                      isSelected
                        ? 'bg-orange-50 dark:bg-orange-900/20 border-orange-300 dark:border-orange-700 ring-2 ring-orange-400'
                        : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${
                        isSelected
                          ? 'bg-orange-100 dark:bg-orange-900/40'
                          : 'bg-gray-200 dark:bg-gray-700'
                      }`}>
                        <ComputerDesktopIcon className={`w-6 h-6 ${
                          isSelected
                            ? 'text-orange-600 dark:text-orange-400'
                            : 'text-gray-500 dark:text-gray-400'
                        }`} />
                      </div>
                      <div>
                        <p className={`font-semibold ${
                          isSelected
                            ? 'text-orange-700 dark:text-orange-300'
                            : 'text-gray-900 dark:text-white'
                        }`}>
                          {terminal.name}
                        </p>
                        {terminal.location && (
                          <p className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 mt-0.5">
                            <MapPinIcon className="w-3 h-3" />
                            {terminal.location}
                          </p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {hasActiveSession && (
                        <span className="flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 px-2 py-1 rounded-full">
                          <SignalIcon className="w-3 h-3" />
                          In Use
                        </span>
                      )}
                      {isSelected && (
                        <CheckCircleIcon className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Create New Terminal */}
          {(!hasTerminals || showCreateForm) ? (
            <div className="space-y-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
              <h4 className="text-sm font-medium text-gray-900 dark:text-white">
                {hasTerminals ? 'Create New Terminal' : 'Set Up Your First Terminal'}
              </h4>
              {!hasTerminals && (
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  No terminals configured yet. Create one to get started with POS.
                </p>
              )}
              <div className="space-y-2">
                <Input
                  placeholder="Terminal name (e.g., POS 1, Register A)"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  className="bg-white dark:bg-gray-700"
                />
                <Input
                  placeholder="Location (e.g., Front Counter, Aisle 3)"
                  value={newLocation}
                  onChange={(e) => setNewLocation(e.target.value)}
                  className="bg-white dark:bg-gray-700"
                />
                <div className="flex gap-2">
                  <Button onClick={handleCreate} disabled={!newName.trim()}>
                    <PlusIcon className="w-4 h-4 mr-1" />
                    Create & Assign
                  </Button>
                  {hasTerminals && (
                    <Button variant="outline" onClick={() => setShowCreateForm(false)}>
                      Cancel
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <button
              onClick={() => setShowCreateForm(true)}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-lg border-2 border-dashed border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:border-gray-400 dark:hover:border-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            >
              <PlusIcon className="w-4 h-4" />
              <span className="text-sm font-medium">Add New Terminal</span>
            </button>
          )}
        </div>
      </ModalBody>
      {currentTerminalId && (
        <ModalFooter>
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </ModalFooter>
      )}
    </Modal>
  );
}
