/**
 * exporter.js — Converts Lab Designer data to Skillable Lab on Demand (LOD) export format.
 * Generates one JSON file per lab following the LOD schema.
 */

const SkillableExporter = (() => {

    let _idCounter = 100000;
    function nextId() { return _idCounter++; }

    // Platform mapping
    const cloudPlatformMap = {
        'azure': 10,
        'aws': 20,
        'gcp': 30,
        'multi': 10, // default to Azure
        '': 0,
    };

    const platformUrlMap = {
        'azure': 'https://portal.azure.com',
        'aws': 'https://console.aws.amazon.com',
        'gcp': 'https://console.cloud.google.com',
        'multi': 'https://portal.azure.com',
    };

    // OS to Skillable VM profile mapping
    const osMap = {
        'windows-server': { os: 'Windows Server 2022', platformId: 2 },
        'windows-11': { os: 'Windows 11', platformId: 2 },
        'ubuntu': { os: 'Ubuntu 22.04 LTS', platformId: 10 },
        'centos': { os: 'CentOS 8', platformId: 10 },
        'custom': { os: 'Custom Image', platformId: 2 },
    };

    // Difficulty to LOD Level mapping
    const levelMap = {
        'beginner': 100,
        'intermediate': 200,
        'advanced': 300,
        'expert': 400,
    };

    // Development status
    const statusMap = {
        'draft': 1,
        'review': 5,
        'published': 10,
    };

    /**
     * Build a Skillable-format network object
     */
    function buildNetwork(name, type, id) {
        return {
            Id: id,
            Name: name,
            Description: null,
            PhysicalNetworkAdapterName: null,
            IsStudentVisible: false,
            DevelopmentOnly: false,
            Type: type, // 10 = Internet/NAT, 0 = Internal, 20 = Public IP
            VLanId: null,
            GatewayAddress: type === 10 ? '192.168.1.1' : null,
            SubnetMask: type === 10 ? '255.255.255.0' : null,
            EnableDhcp: type === 10,
            DhcpStart: type === 10 ? '192.168.1.100' : null,
            DhcpEnd: type === 10 ? '192.168.1.200' : null,
            SubnetId: null,
            EnableNat: false,
            CustomNetworkId: null,
            AccessControlListId: null,
            EnableEndpoints: false,
            EndpointGatewayIpAddress: null,
            EndpointGatewaySubnetMask: null,
        };
    }

    /**
     * Build a Skillable-format VM machine entry
     */
    function buildMachine(vm, sortOrder, networkId, vmProfileId) {
        const machineId = nextId();
        const adapterId = nextId();
        const connectionId = nextId();
        return {
            Id: machineId,
            MachineProfileId: vmProfileId,
            DisplayName: vm.name || 'LabVM',
            IsStudentVisible: true,
            AutoStart: true,
            InitialSystemTime: null,
            IsHostTimeSyncEnabled: true,
            StartupDelaySeconds: null,
            SortOrder: sortOrder,
            FloppyMediaId: null,
            DvdMediaId: null,
            NetworkConnections: [
                {
                    Id: connectionId,
                    NetworkProfileId: networkId,
                    AdapterId: adapterId,
                    IsStudentVisible: false,
                },
            ],
            StartStateDisks: [],
            Endpoints: [],
            WaitForHeartbeat: true,
            ResumeOrder: sortOrder,
            ResumeDelaySeconds: null,
            ReplacementTokenAlias: vm.name || 'LabVM',
            AllowDesktopConnections: true,
            AllowSshConnections: (vm.os === 'ubuntu' || vm.os === 'centos'),
            TrackLabInstanceData: false,
        };
    }

    /**
     * Build a Skillable-format VM profile
     */
    function buildVMProfile(vm, seriesId) {
        const osInfo = osMap[vm.os] || osMap['windows-11'];
        const profileId = nextId();
        const adapterId = nextId();
        const scsiId = nextId();
        const diskId = nextId();
        const dvdId = nextId();

        return {
            id: profileId,
            profile: {
                Id: profileId,
                SeriesId: seriesId,
                Name: vm.name || 'LabVM',
                Description: `${osInfo.os} virtual machine for lab environment.`,
                PlatformId: osInfo.platformId,
                OperatingSystem: osInfo.os,
                Ram: 8192,
                HostIntegrationEnabled: true,
                Username: 'LabUser',
                Password: 'Pa$$w0rd',
                ScreenWidth: 1024,
                ScreenHeight: 768,
                Cmos: null,
                BootOrder: '1,2,3,0',
                EnableDynamicScreenResizing: true,
                OperatingSystemValue: osInfo.platformId === 2 ? 'windows9_64Guest' : 'ubuntu64Guest',
                EnableNestedVirtualization: false,
                HideVirtualizationFromGuestOs: false,
                NumProcessors: 4,
                NumCoresPerProcessor: 1,
                VideoRam: 32,
                Enable3DVideo: false,
                EnableHostCompatibility: true,
                RdpFileText: null,
                HardDisks: [
                    {
                        Id: diskId,
                        FilePath: `Placeholder\\${vm.name || 'LabVM'}\\disk.vhdx`,
                        ScsiAdapterId: scsiId,
                        AttachmentIndex: 0,
                        SortOrder: 0,
                        DifferencingDiskId: null,
                        IsOsDisk: true,
                    },
                ],
                NetworkAdapters: [
                    {
                        Id: adapterId,
                        Name: 'NIC0',
                        EthernetAddress: '00155D018000',
                        HardwareId: null,
                        IsLegacy: false,
                        AllowMacSpoofing: false,
                        VLanId: null,
                        SortOrder: 0,
                        TypeId: 0,
                        MonitoringMode: 0,
                    },
                ],
                ScsiAdapters: [
                    {
                        Id: scsiId,
                        ScsiId: 7,
                        IsBusShared: false,
                        TypeId: 0,
                        SortOrder: 0,
                    },
                ],
                DvdRomDrives: [
                    {
                        Id: dvdId,
                        AttachmentIndex: 1,
                        ScsiAdapterId: scsiId,
                    },
                ],
                TargetResourceGroup: null,
                CloudOperatingSystemType: 0,
                DiskType: 0,
                UseCloudHybridBenefit: false,
                Enabled: true,
                AllowDiskUpdatesInLabConsole: true,
                Generation: 2,
                HardwareVersion: 14,
                UseEnhancedSessionMode: true,
                ColorDepth: 0,
                RedirectSmartCards: false,
                RedirectPrinters: false,
                RedirectDrives: false,
                RedirectDevices: false,
                CaptureAudioInput: false,
                RedirectAudioOutput: false,
                RedirectClipboard: true,
                AttemptAutoLogon: false,
                AllowDesktopWallpaper: false,
                EnableFontSmoothing: true,
                MachineType: 'A0',
                ExternalMachineImage: null,
                ExternalMachineImageRegion: null,
                ExternalMachineImageAccount: null,
                UseAzureMarketplaceImage: false,
                AzureMarketplaceImagePlanId: null,
                AzureMarketplaceImageProductId: null,
                AzureMarketplaceImagePublisherId: null,
                BiosGuid: null,
                EnableTrustedPlatformModule: true,
                EnableSecureBoot: true,
                UseEfi: false,
            },
        };
    }

    /**
     * Convert lab instructions (steps) to Skillable markdown format with page breaks (===)
     */
    function buildInstructionsMarkdown(lab) {
        const steps = lab.steps || [];
        if (steps.length === 0) return '';

        const sections = steps.map((step, idx) => {
            let md = `# Step ${idx + 1}: ${step.title || 'Untitled Step'}\n\n`;
            if (step.instructions) {
                md += step.instructions + '\n';
            }
            return md;
        });

        return sections.join('\n===\n');
    }

    /**
     * Build cloud resource groups
     */
    function buildCloudResourceGroups(lab, labProfileId) {
        const resources = lab.cloudResources || [];
        if (resources.length === 0 && lab.platform) {
            // Create a default resource group
            return [{
                Id: nextId(),
                DisplayName: 'ResourceGroup1',
                ReplacementTokenAlias: 'ResourceGroup1',
                LabProfileId: labProfileId,
                CloudTemplateResourceGroups: [],
                CloudResourceParameterValues: [],
                AccessControlPolicyResourceGroups: [],
                CloudQuotaResourceGroups: [],
            }];
        }
        return resources.map((res, idx) => ({
            Id: nextId(),
            DisplayName: res.name || `Resource${idx + 1}`,
            ReplacementTokenAlias: (res.name || `Resource${idx + 1}`).replace(/[^a-zA-Z0-9]/g, ''),
            LabProfileId: labProfileId,
            CloudTemplateResourceGroups: [],
            CloudResourceParameterValues: [],
            AccessControlPolicyResourceGroups: [],
            CloudQuotaResourceGroups: [],
        }));
    }

    /**
     * Build credential profiles JSON for cloud platform
     */
    function buildCredentialProfilesJson(platform) {
        if (!platform) return null;
        return JSON.stringify([{
            LocalId: 1,
            ResourceGroupPermissionMappings: [{
                Id: 1,
                ResourceGroupName: 'ResourceGroup1',
                PermissionId: 'b24988ac-6180-42a0-ab88-20f7382dd24c',
            }],
            SubscriptionPermissionMappings: [{
                Id: 1,
                PermissionId: 'b24988ac-6180-42a0-ab88-20f7382dd24c',
            }],
            AccountNamePrefix: 'User1-',
            ReplacementTokenAlias: 'User1',
        }]);
    }

    /**
     * Build LifeCycleActions array for a lab.
     * If the lab has a buildScript, create a PowerShell script action that runs at lab start (Event=10).
     */
    function buildLifeCycleActions(lab, vmProfiles) {
        const actions = [];
        const buildScript = lab.buildScript || '';

        if (buildScript.trim()) {
            // Determine script target — use first VM profile if available
            const targetId = vmProfiles.length > 0 ? vmProfiles[0].id : null;

            actions.push({
                Id: nextId(),
                Name: 'Environment Build Script',
                Event: 10,              // 10 = Running (lab start)
                ActionType: 40,         // 40 = Execute Script (machine)
                Url: null,
                HttpVerb: 0,
                Synchronous: true,
                ErrorAction: 0,
                Timeout: 1200,          // 20 minutes
                SortOrder: 0,
                AppendLabData: false,
                CustomErrorNotification: null,
                HttpHeaders: null,
                HttpContent: null,
                Notification: null,
                Subject: null,
                ScriptTargetId: targetId,
                ScriptLanguage: 0,      // 0 = PowerShell
                Script: buildScript,
                ScriptDescription: 'Provisions the unified cloud environment for this lab.',
                ScriptGuidance: null,
                ScriptSource: 0,
                Delay: 0,
                Enabled: true,
                NotificationName: null,
                ScriptEngineImageId: 5,
                ScriptEnginePackagesJson: null,
                RepeatScriptUntilTrue: false,
                RepeatScriptIntervalSeconds: 60,
                RepeatScriptTimeoutMinutes: 20,
                MaxRetries: 1,
                CopilotPromptJson: null,
                RunWithElevatedPermissions: true,
            });
        }

        return actions;
    }

    /**
     * Convert a single lab to Skillable LOD export format
     */
    function labToSkillable(lab, skills) {
        _idCounter = Math.floor(Math.random() * 100000) + 200000; // reset per lab to avoid collisions

        const labProfileId = nextId();
        const seriesId = nextId();
        const platform = lab.platform || '';
        const cloudPlatform = cloudPlatformMap[platform] || 0;

        // Build networks
        const internetNetworkId = nextId();
        const networks = [buildNetwork('Internet', 10, internetNetworkId)];

        // Build VM profiles and machines
        const vms = lab.vms || [];
        const vmProfiles = [];
        const machines = [];

        vms.forEach((vm, idx) => {
            const vpResult = buildVMProfile(vm, seriesId);
            vmProfiles.push(vpResult);
            machines.push(buildMachine(vm, idx, internetNetworkId, vpResult.id));
        });

        // Build instructions
        const instructionsMarkdown = buildInstructionsMarkdown(lab);

        // Build Instructions Sets (pages/exercises)
        const instructionsSets = [];
        if (instructionsMarkdown) {
            instructionsSets.push({
                Id: nextId(),
                Name: 'Base Instructions Set',
                Enabled: true,
                Instructions: instructionsMarkdown,
                DisplayId: 'Base-01',
                LabTitle: lab.title || 'Untitled Lab',
                DurationMinutes: lab.duration || 60,
                LanguageId: 1,
                AiTranslationStatus: 0,
                PassingScore: 1,
                RawCutoffScore: 1,
                ScoringResultsDisplayType: 10,
                EndOfLabScoreType: 0,
                ScoringMode: 0,
                EnableTaskProgressTracking: true,
                EnableTaskAutoChecking: false,
                RequireTasksCompletedInOrder: false,
                VariablesJson: null,
                ReplacementsJson: null,
                OrganizationId: 4997,
                Editable: true,
            });
        }

        // Map skill IDs to Product objects
        const labSkills = (lab.skillIds || []).map(id => skills.find(s => s.id === id)).filter(Boolean);
        const products = [];
        if (platform === 'azure' || platform === 'multi') {
            products.push({ LabProfileId: labProfileId, ProductId: 20, Name: 'Azure' });
        }
        if (platform === 'aws' || platform === 'multi') {
            products.push({ LabProfileId: labProfileId, ProductId: 30, Name: 'AWS' });
        }
        if (platform === 'gcp' || platform === 'multi') {
            products.push({ LabProfileId: labProfileId, ProductId: 40, Name: 'GCP' });
        }

        // Cloud resource groups
        const cloudResourceGroups = platform ? buildCloudResourceGroups(lab, labProfileId) : [];

        // Build the full export object
        const exportObj = {
            SourceId: 'lab-designer',
            LabSeries: [],
            LabProfiles: [
                {
                    ContentVersion: 2,
                    HasContent: true,
                    Id: labProfileId,
                    SourceUrl: null,
                    SeriesId: seriesId,
                    Name: lab.title || 'Untitled Lab',
                    Sku: null,
                    Number: lab.id ? `LAB-${lab.id.toUpperCase().slice(0, 8)}` : null,
                    PlatformId: vms.length > 0 ? 2 : (cloudPlatform > 0 ? 3 : 2),
                    DevelopmentStatusId: statusMap[lab.status] || 1,
                    Level: levelMap[lab.difficulty] || 100,
                    DurationMinutes: lab.duration || 60,
                    Description: lab.description || null,
                    Enabled: lab.status === 'published',
                    ShowNavigationPane: true,
                    AllowCancel: true,
                    AllowSave: false,
                    EnableAutoSave: false,
                    LastConsoleSyncTimeoutMinutes: Math.max(lab.duration || 60, 15),
                    LastActivityTimeoutMinutes: Math.max(lab.duration || 60, 120),
                    EnableExpirationNotificationEmail: false,
                    ExpirationNotificationEmailMinutes: 0,
                    EnableScheduledDisablement: false,
                    ScheduledDisableDateTime: null,
                    MinimumAutoSaveTimeInvestment: 5,
                    MaxSnapshots: 0,
                    HasVirtualMachinePool: false,
                    InheritLifeCycleActions: false,
                    Networks: networks,
                    Machines: machines,
                    RemovableMediaIds: [],
                    MachinePool: [],
                    MachinePoolMembers: [],
                    Resources: [],
                    ContainerImages: [],
                    ContainerNetworks: [],
                    ContainerVolumeIds: [],
                    CloudPortalCredentialProfilesJson: platform ? buildCredentialProfilesJson(platform) : null,
                    LifeCycleActions: buildLifeCycleActions(lab, vmProfiles),
                    CodeLanguages: null,
                    CodeTests: null,
                    EnableCodeLabFabric: false,
                    CloudSubscriptionInstancePolicies: [],
                    CloudScriptContextPolicies: [],
                    CloudSubscriptionInstanceQuotas: [],
                    CloudResourceGroups: cloudResourceGroups,
                    CloudCredentialPoolAssignments: [],
                    Activities: [],
                    ActivityGroups: [],
                    InstructionsSets: instructionsSets,
                    LabProfileMappedProductMetadata: null,
                    Products: products,
                    MinInstanceStorageGb: 20,
                    AllowTimeExtensions: true,
                    Ram: vms.length > 0 ? vms.length * 8192 : 0,
                    NavigationBarWidth: 400,
                    PreinstanceBatchSize: 1,
                    PreinstanceStockLevel: 0,
                    SavePreinstances: true,
                    PreinstanceSaveDelaySeconds: 0,
                    ShowContentTab: true,
                    ShowMachinesTab: vms.length > 0,
                    ShowSupportTab: true,
                    EndUrl: null,
                    OwnerName: null,
                    OwnerEmail: null,
                    CustomContentTabLabel: null,
                    CustomMachinesTabLabel: null,
                    CustomSupportTabLabel: null,
                    CloudPlatform: cloudPlatform,
                    IntroductionContentUrl: null,
                    IntroductionContentMinimumDisplaySeconds: null,
                    AnonymousLaunchExpires: null,
                    AnonymousSaveMaxDays: 7,
                    AnonymousSaveMaxSessions: 5,
                    ShowTimer: true,
                    StorageLoadingPriority: 20,
                    InheritStorageAvailability: true,
                    CloudSubscriptionPoolId: null,
                    EnableNavigationWarning: true,
                    ShowVirtualMachinePowerOptions: true,
                    StartStateDirectoryPath: null,
                    EnableInstanceLinkSharing: false,
                    EnableCopyPaste: true,
                    LtiOutcomeScoringPolicy: 0,
                    LtiOutcomeScoringFormat: 0,
                    LtiOutcomePassingScoreMinutes: 15,
                    LtiOutcomePassingScoreTaskCompletePercentage: 70,
                    DefaultVirtualMachineProfileId: vmProfiles.length > 0 ? vmProfiles[0].id : null,
                    DefaultVirtualMachineLabPoolProfileId: null,
                    DefaultResourceId: null,
                    NumVirtualMachines: vms.length,
                    NumPublicIpAddresses: 0,
                    RequiresNestedVirtualization: false,
                    PremiumPrice: null,
                    CustomPremiumPrice: null,
                    ExpectedCloudCost: null,
                    OverrideScriptContext: false,
                    RunScriptAsAdmin: false,
                    CloudPortalUrl: platformUrlMap[platform] || null,
                    OverrideCloudPortalUrl: false,
                    EnableAutomaticPortalLogin: false,
                    DeployDefaultResources: false,
                    AppendLabDataToCloudPortalUrl: false,
                    TerminateOnFailedDeployment: true,
                    SendNotificationOnFailedDeployment: false,
                    TimeExtensionMinutes: 15,
                    TimeExtensionShowNotificationMinutes: 10,
                    EnableBugReporting: false,
                    BugReportEmailAddress: null,
                    DisplayDelaySeconds: null,
                    DisplayDelayMessage: null,
                    MaxActiveLabInstances: null,
                    ThemeId: null,
                    Tags: [],
                    LabHostTags: [],
                    NumVcpus: vms.length > 0 ? vms.reduce((s) => s + 4, 0) : 0,
                    LabFabricBuildSequence: 0,
                    AllowDisconnect: false,
                    CloudDatacenterAvailability: [],
                    RecordRdpSession: false,
                    MaxAllowedBuildMinutes: 60,
                    MaxAllowedBuildTimeAction: 10,
                    DefaultLanguageId: 1,
                    DefaultInstructionsDisplayId: 'Base-01',
                    ShowInstructionsWhileBuilding: false,
                    MaxAiTokensPerLabInstance: 100000,
                    MaxAiTokensPerLabInstanceCustomMessage: null,
                    ExamScoringItems: [],
                    Exercises: [],
                    AllowMultipleActiveInstancesPerUser: false,
                    AllowLabInstanceNaming: false,
                    NumExposedContainerPorts: 0,
                    ExamShowResult: false,
                    ExamShowResultDetails: false,
                    IsExam: false,
                    ExamPassingScore: 0,
                    Instructions: null,
                    EnableTaskProgressTracking: true,
                    RequireTasksCompletedInOrder: false,
                    EnableTaskAutoChecking: false,
                    VariablesJson: null,
                    InstructionsReplacementsJson: null,
                    LanguageId: 0,
                },
            ],
            VirtualMachineProfiles: vmProfiles.map(vp => vp.profile),
            RemovableMedia: [],
            CloudTemplates: [],
            AccessControlPolicies: [],
            CloudQuotas: [],
            AccessControlLists: [],
            ContainerImages: [],
            ContainerVolumes: [],
        };

        return exportObj;
    }

    /**
     * Export all labs as individual Skillable-format zip files.
     * Each zip contains data.json (and a content/ folder placeholder).
     * Format: {LabName}.zip with data.json inside — matches Skillable LOD import format.
     */
    async function exportAllLabs() {
        const labs = Store.getLabs();
        const skills = Store.getSkills();

        if (labs.length === 0) {
            alert('No labs to export.');
            return;
        }

        if (typeof JSZip === 'undefined') {
            alert('JSZip library not loaded. Cannot create zip files.');
            return;
        }

        // If multiple labs, wrap all into a single outer zip containing individual lab zips
        if (labs.length === 1) {
            const lab = labs[0];
            await exportSingleLabZip(lab, skills);
        } else {
            // Download each lab as its own zip, staggered
            for (let i = 0; i < labs.length; i++) {
                await exportSingleLabZip(labs[i], skills);
                // Small delay between downloads to avoid browser blocking
                if (i < labs.length - 1) {
                    await new Promise(r => setTimeout(r, 300));
                }
            }
        }
    }

    /**
     * Export a single lab as a Skillable-format zip file.
     */
    async function exportSingleLabZip(lab, skills) {
        const exported = labToSkillable(lab, skills);
        const json = JSON.stringify(exported, null, 2);
        const labProfileId = exported.LabProfiles[0].Id;

        const zip = new JSZip();

        // Add data.json at the root of the zip
        zip.file('data.json', json);

        // Add empty content folder structure (placeholder for images/screens)
        // This matches the Skillable format: content/{labProfileId}/
        zip.folder(`content/${labProfileId}`);

        const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
        const filename = sanitizeFilename(lab.title || 'lab') + '.zip';
        downloadBlob(filename, blob);
    }

    function sanitizeFilename(name) {
        return name
            .replace(/[^a-zA-Z0-9\s\-_]/g, '')
            .replace(/\s+/g, ' ')
            .trim()
            .slice(0, 80);
    }

    function downloadBlob(filename, blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    return {
        labToSkillable,
        exportAllLabs,
        exportSingleLabZip,
    };
})();
