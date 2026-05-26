import React, { useState, useEffect } from "react";
import { invoke } from '@tauri-apps/api/core';
import { getVersion } from '@tauri-apps/api/app';
import Image from '@/lib/vite-shims/image';
import AnalyticsConsentSwitch from "./AnalyticsConsentSwitch";
import { UpdateDialog } from "./UpdateDialog";
import { updateService, UpdateInfo } from '@/services/updateService';
import { Button } from './ui/button';
import { Loader2, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import { APP_DESCRIPTION, APP_NAME, APP_TAGLINE } from '@/constants/branding';


export function About() {
    const [currentVersion, setCurrentVersion] = useState<string>('0.3.0 Beta');
    const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
    const [isChecking, setIsChecking] = useState(false);
    const [showUpdateDialog, setShowUpdateDialog] = useState(false);

    useEffect(() => {
        // Get current version on mount
        getVersion().then((version) => setCurrentVersion(`${version} Beta`)).catch(console.error);
    }, []);

    const handleContactClick = async () => {
        try {
            await invoke('open_external_url', { url: 'https://www.infomaniak.com/en/hosting/ai-services' });
        } catch (error) {
            console.error('Failed to open link:', error);
        }
    };

    const handleCheckForUpdates = async () => {
        setIsChecking(true);
        try {
            const info = await updateService.checkForUpdates(true);
            setUpdateInfo(info);
            if (info.available) {
                setShowUpdateDialog(true);
            } else {
                toast.success('You are running the latest version');
            }
        } catch (error: any) {
            console.error('Failed to check for updates:', error);
            toast.error('Failed to check for updates: ' + (error.message || 'Unknown error'));
        } finally {
            setIsChecking(false);
        }
    };

    return (
        <div className="p-5 space-y-5 h-[80vh] overflow-y-auto">
            {/* Compact Header */}
            <div className="text-center">
                <div className="mb-3">
                    <Image
                        src="icon_128x128.png"
                        alt={`${APP_NAME} logo`}
                        width={64}
                        height={64}
                        className="mx-auto"
                    />
                </div>
                <h1 className="text-xl font-semibold text-stone-950">{APP_NAME}</h1>
                <span className="text-sm text-gray-500"> v{currentVersion}</span>
                <p className="text-sm font-medium text-stone-800 mt-2">
                    {APP_TAGLINE}
                </p>
                <p className="text-sm text-stone-600 mt-1">
                    {APP_DESCRIPTION}
                </p>
                <div className="mt-3">
                    <Button
                        onClick={handleCheckForUpdates}
                        disabled={isChecking}
                        variant="outline"
                        size="sm"
                        className="text-xs"
                    >
                        {isChecking ? (
                            <>
                                <Loader2 className="h-3 w-3 mr-2 animate-spin" />
                                Checking...
                            </>
                        ) : (
                            <>
                                <CheckCircle2 className="h-3 w-3 mr-2" />
                                Check for Updates
                            </>
                        )}
                    </Button>
                    {updateInfo?.available && (
                        <div className="mt-2 text-xs text-blue-600">
                            Update available: v{updateInfo.version}
                        </div>
                    )}
                </div>
            </div>

            {/* Features Grid - Compact */}
            <div className="space-y-3">
                <h2 className="text-base font-semibold text-stone-900">Designed for Swiss meeting protocols</h2>
                <div className="grid grid-cols-2 gap-2">
                    <div className="bg-stone-50 rounded-md p-3 hover:bg-stone-100 transition-colors">
                        <h3 className="font-semibold text-sm text-stone-950 mb-1">Swiss German first</h3>
                        <p className="text-xs text-stone-600 leading-relaxed">Defaults favor German-language output from Swiss German speech for cleaner minutes.</p>
                    </div>
                    <div className="bg-stone-50 rounded-md p-3 hover:bg-stone-100 transition-colors">
                        <h3 className="font-semibold text-sm text-stone-950 mb-1">Swiss-host ready</h3>
                        <p className="text-xs text-stone-600 leading-relaxed">Point summaries to local open-source models or owner-managed Infomaniak.</p>
                    </div>
                    <div className="bg-stone-50 rounded-md p-3 hover:bg-stone-100 transition-colors">
                        <h3 className="font-semibold text-sm text-stone-950 mb-1">Local by default</h3>
                        <p className="text-xs text-stone-600 leading-relaxed">Meeting audio and transcripts stay under your control unless you configure a server.</p>
                    </div>
                    <div className="bg-stone-50 rounded-md p-3 hover:bg-stone-100 transition-colors">
                        <h3 className="font-semibold text-sm text-stone-950 mb-1">Quiet interface</h3>
                        <p className="text-xs text-stone-600 leading-relaxed">Record, review, and export without dashboard noise.</p>
                    </div>
                </div>
            </div>

            <div className="bg-emerald-50 rounded-md p-3">
                <p className="text-sm text-emerald-900">
                    <span className="font-semibold">Recommended:</span> use Whisper large-v3-turbo with German language output for Swiss German meetings; use a stronger Swiss-hosted endpoint for summaries when needed.
                </p>
            </div>

            <div className="text-center space-y-2">
                <h3 className="text-sm font-semibold text-stone-900">Swiss-hosted inference</h3>
                <p className="text-sm text-stone-600">
                    Use local open-source models or owner-managed Infomaniak AI Services.
                </p>
                <button
                    onClick={handleContactClick}
                    className="inline-flex items-center px-4 py-2 bg-stone-950 hover:bg-stone-800 text-white text-sm font-medium rounded-md transition-colors duration-200"
                >
                    Open Infomaniak AI Services
                </button>
            </div>

            {/* Footer - Compact */}
            <div className="pt-2 border-t border-gray-200 text-center">
                <p className="text-xs text-gray-400">
                    Protocolito
                </p>
            </div>
            <AnalyticsConsentSwitch />

            {/* Update Dialog */}
            <UpdateDialog
                open={showUpdateDialog}
                onOpenChange={setShowUpdateDialog}
                updateInfo={updateInfo}
            />
        </div>

    )
}
