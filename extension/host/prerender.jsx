/* PreRendering V2.0 core adapted for the Motion Graphics CEP host. */
var MGPreRendering = (function () {
    var SCRIPT_NAME = "PreRendering V2.0";
    var SCRIPT_VERSION = "2.2.0";
    var META_PREFIX = "PreRenderingV2|";
    var MODE_PREFIX = "PreRenderingV2Mode=";
    var GROUP_LABELS = [9, 10, 11, 13, 14, 15, 16, 2, 3, 4, 5, 6, 7, 8, 1, 12];
    var DEFAULT_CACHE_FOLDER = "PreRenderingCacheV2";
    var RANGE_MARKER_COMMENT = "PR_RANGE";

    var state = {
        panel: null,
        sourceComp: null,
        lastPreviewComp: null,
        lastOutputItem: null,
        templateNames: [],
        lastGroupId: "",
        lastStatus: "",
        bridgeMode: true,
        risksConfirmed: false
    };

    var T = {
        title: "\u9884\u6e32\u67d3 V2.0",
        source: "\u6e90\u5408\u6210",
        noComp: "\u8bf7\u5148\u6fc0\u6d3b\u4e00\u4e2a\u5408\u6210\u3002",
        scope: "\u9884\u6e32\u67d3\u5bf9\u8c61",
        audioPolicyHint: "\u7eaf\u97f3\u9891\u5c42\u81ea\u52a8\u8df3\u8fc7\uff1a\u4e0d\u5f52\u7ec4\u3001\u4e0d\u88c1\u5207\uff0c\u4fdd\u7559\u539f\u97f3\u9891\u72b6\u6001\u3002\u6240\u9009\u56fe\u5c42\u5165\u51fa\u70b9\u4ecd\u6309\u624b\u52a8\u9009\u62e9\u8ba1\u7b97\u3002",
        scopes: [
            "\u5f53\u524d\u5408\u6210\u5168\u90e8",
            "\u6240\u9009\u8fde\u7eed\u56fe\u5c42",
            "\u6700\u4e0a\u65b9\u6240\u9009\u56fe\u5c42\u53ca\u4ee5\u4e0b"
        ],
        range: "\u65f6\u95f4\u8303\u56f4",
        ranges: [
            "\u5de5\u4f5c\u533a",
            "\u5f53\u524d\u5408\u6210\u5168\u90e8",
            "\u6240\u9009\u56fe\u5c42\u5165\u51fa\u70b9",
            "\u5408\u6210\u6807\u8bb0\u8303\u56f4"
        ],
        createRangeMarker: "\u521b\u5efa\u8303\u56f4\u6807\u8bb0",
        rangeMarkerCreated: "\u5df2\u4ece\u5f53\u524d\u65f6\u95f4\u6307\u9488\u521b\u5efa 1 \u79d2\u7684 PR_RANGE \u5408\u6210\u6807\u8bb0\uff08\u9760\u8fd1\u5408\u6210\u7ed3\u5c3e\u65f6\u4f1a\u622a\u5230\u7ed3\u675f\u70b9\uff09\u3002\u53ef\u5728\u65f6\u95f4\u8f74\u4e0a\u62d6\u52a8\u5b83\u7684\u8d77\u70b9\u548c\u7ec8\u70b9\u3002",
        rangeMarkerAtEnd: "\u5f53\u524d\u65f6\u95f4\u6307\u9488\u5df2\u7ecf\u4f4d\u4e8e\u5408\u6210\u7ed3\u675f\u5904\uff0c\u65e0\u6cd5\u521b\u5efa\u6709\u6548\u8303\u56f4\u3002\u8bf7\u5c06\u65f6\u95f4\u6307\u9488\u5411\u524d\u79fb\u52a8\u81f3\u5c11\u4e00\u5e27\u3002",
        rangeMarkerExists: "\u5df2\u5b58\u5728 PR_RANGE \u5408\u6210\u6807\u8bb0\uff0c\u5df2\u8df3\u8f6c\u5230\u5b83\u7684\u8d77\u70b9\u3002\u6309\u94ae\u4e0d\u4f1a\u8986\u76d6\u7528\u6237\u8c03\u6574\u7684\u8303\u56f4\u3002",
        rangeMarkerMissing: "\u5f53\u524d\u5408\u6210\u6ca1\u6709 PR_RANGE \u8303\u56f4\u6807\u8bb0\u3002\u8bf7\u5148\u70b9\u51fb\u201c\u521b\u5efa\u8303\u56f4\u6807\u8bb0\u201d\u3002",
        rangeMarkerZero: "PR_RANGE \u6807\u8bb0\u6ca1\u6709\u6301\u7eed\u65f6\u95f4\u3002\u8bf7\u62d6\u52a8\u6807\u8bb0\u7ec8\u70b9\uff0c\u4f7f\u5176\u81f3\u5c11\u5305\u542b\u4e00\u5e27\u3002",
        rangeMarkerMultiple: "\u5f53\u524d\u5408\u6210\u5b58\u5728\u591a\u4e2a PR_RANGE \u6807\u8bb0\u3002\u8bf7\u53ea\u4fdd\u7559\u4e00\u4e2a\u3002",
        rangeMarkerCollision: "\u5de5\u4f5c\u533a\u8d77\u70b9\u5df2\u6709\u5176\u4ed6\u5408\u6210\u6807\u8bb0\u3002\u8bf7\u79fb\u52a8\u8be5\u6807\u8bb0\u6216\u8c03\u6574\u5de5\u4f5c\u533a\u8d77\u70b9\u540e\u91cd\u8bd5\u3002",
        markerUnsupported: "\u5f53\u524d AE \u7248\u672c\u4e0d\u652f\u6301\u5408\u6210\u6807\u8bb0\u811a\u672c\u63a5\u53e3\u3002",
        resultMode: "\u7ed3\u679c\u65b9\u5f0f",
        resultModes: [
            "\u5e94\u7528\u5230\u539f\u5408\u6210\uff08\u63a8\u8350\uff09",
            "\u751f\u6210\u72ec\u7acb\u9884\u89c8\u5408\u6210"
        ],
        applyHint: "\u5e94\u7528\u6a21\u5f0f\u4f1a\u4fee\u6539\u539f\u5408\u6210\uff1a\u76ee\u6807\u56fe\u5c42\u5728\u7f13\u5b58\u533a\u95f4\u5904\u5207\u5206\uff0c\u533a\u95f4\u5185\u4f7f\u7528\u9884\u6e32\u67d3\uff0c\u533a\u95f4\u5916\u4fdd\u7559\u4e3a\u666e\u901a\u53ef\u7f16\u8f91\u56fe\u5c42\u3002\u53ef\u7acb\u5373\u64a4\u9500\u3002",
        template: "\u8f93\u51fa\u6a21\u677f",
        refreshTemplates: "\u5237\u65b0",
        outputFolder: "\u8f93\u51fa\u76ee\u5f55",
        browse: "\u9009\u62e9",
        render: "\u5f00\u59cb\u9884\u6e32\u67d3",
        openSource: "\u6253\u5f00\u6e90\u5408\u6210",
        openPreview: "\u6253\u5f00\u6700\u8fd1\u7ed3\u679c",
        status: "\u72b6\u6001",
        statusReady: "\u5c31\u7eea\u3002\u9ed8\u8ba4\u4f7f\u7528\u5de5\u4f5c\u533a\u5e76\u5e94\u7528\u5230\u539f\u5408\u6210\u3002",
        statusRendering: "\u6b63\u5728\u9884\u6e32\u67d3\uff0cAE \u754c\u9762\u53ef\u80fd\u6682\u65f6\u65e0\u54cd\u5e94\u2026",
        statusDone: "\u5b8c\u6210\u3002\u5df2\u751f\u6210\u9884\u89c8\u5408\u6210\uff1a",
        statusDoneApplied: "\u5b8c\u6210\u3002\u9884\u6e32\u67d3\u5df2\u5e94\u7528\u5230\u539f\u5408\u6210\uff1a",
        chooseFolder: "\u9009\u62e9\u9884\u6e32\u67d3\u8f93\u51fa\u76ee\u5f55",
        noTemplate: "\u6ca1\u6709\u53ef\u7528\u7684\u8f93\u51fa\u6a21\u677f\u3002",
        selectLayer: "\u5f53\u524d\u6a21\u5f0f\u9700\u8981\u81f3\u5c11\u9009\u62e9\u4e00\u4e2a\u56fe\u5c42\u3002",
        contiguousOnly: "\u201c\u6240\u9009\u56fe\u5c42\u201d\u6a21\u5f0f\u53ea\u652f\u6301\u8fde\u7eed\u56fe\u5c42\u3002",
        invalidRange: "\u65f6\u95f4\u8303\u56f4\u65e0\u6548\u6216\u5c0f\u4e8e\u4e00\u5e27\u3002",
        projectRendering: "AE \u6e32\u67d3\u961f\u5217\u6b63\u5728\u6e32\u67d3\uff0c\u8bf7\u7ed3\u675f\u540e\u518d\u8bd5\u3002",
        renderFailed: "\u9884\u6e32\u67d3\u672a\u5b8c\u6210\u3002",
        importFailed: "\u6e32\u67d3\u5b8c\u6210\uff0c\u4f46\u6ca1\u6709\u627e\u5230\u81ea\u52a8\u5bfc\u5165\u7684\u7d20\u6750\u3002",
        cleanupWarning: "\u9884\u6e32\u67d3\u7ed3\u679c\u5df2\u751f\u6210\uff0c\u4f46\u4e34\u65f6\u6e32\u67d3\u5408\u6210\u6e05\u7406\u5931\u8d25\uff1a",
        alphaWarning: "\u5f53\u524d\u662f\u90e8\u5206\u56fe\u5c42\u9884\u6e32\u67d3\u3002\n\n\u8bf7\u786e\u4fdd\u9009\u4e2d\u7684\u8f93\u51fa\u6a21\u677f\u542b Alpha \u901a\u9053\uff0c\u5426\u5219\u4f1a\u906e\u4f4f\u5176\u4ed6\u56fe\u5c42\u3002\n\n\u662f\u5426\u7ee7\u7eed\uff1f",
        riskWarning: "\u68c0\u6d4b\u5230\u53ef\u80fd\u5f71\u54cd\u7ed3\u679c\u7684\u7ed3\u6784\uff1a\n\n",
        continueQuestion: "\n\n\u662f\u5426\u4ecd\u7136\u7ee7\u7eed\uff1f",
        issueSolo: "\u5408\u6210\u4e2d\u5b58\u5728 Solo \u56fe\u5c42",
        soloBlocked: "\u5c40\u90e8\u9884\u6e32\u67d3\u6682\u4e0d\u652f\u6301\u542b Solo \u72b6\u6001\u7684\u5408\u6210\u3002\u8bf7\u5148\u5173\u95ed Solo\uff0c\u6216\u6539\u7528\u201c\u5f53\u524d\u5408\u6210\u5168\u90e8\u201d\u3002",
        issueTrackMatte: "\u76ee\u6807\u8303\u56f4\u4f7f\u7528\u8f68\u9053\u906e\u7f69",
        issueAdjustment: "\u90e8\u5206\u8303\u56f4\u4e2d\u5305\u542b\u8c03\u6574\u56fe\u5c42",
        issue3D: "\u5206\u754c\u4e0a\u4e0b\u540c\u65f6\u5b58\u5728 3D \u56fe\u5c42",
        issueCollapse: "\u76ee\u6807\u8303\u56f4\u542b\u8fde\u7eed\u6805\u683c\u5316/\u6298\u53e0\u53d8\u6362",
        issueBlendMode: "\u591a\u56fe\u5c42\u5c40\u90e8\u8303\u56f4\u5305\u542b\u975e\u6b63\u5e38\u6df7\u5408\u6a21\u5f0f",
        soloApplyBlocked: "\u201c\u5e94\u7528\u5230\u539f\u5408\u6210\u201d\u6682\u4e0d\u652f\u6301\u542b Solo \u72b6\u6001\u7684\u5408\u6210\u3002\u8bf7\u5148\u5173\u95ed Solo\uff0c\u6216\u6539\u7528\u201c\u751f\u6210\u72ec\u7acb\u9884\u89c8\u5408\u6210\u201d\u3002",
        repeatApplyWarning: "\u5f53\u524d\u5408\u6210\u5df2\u7ecf\u5305\u542b V2 \u9884\u6e32\u67d3\u5757\u3002\u7ee7\u7eed\u521b\u5efa\u4e0d\u91cd\u53e0\u7684\u65f6\u95f4\u5757\u4f1a\u589e\u52a0\u56fe\u5c42\u6570\u91cf\uff1b\u4e0e\u5df2\u6709\u65f6\u95f4\u5757\u91cd\u53e0\u7684\u8303\u56f4\u4f1a\u88ab\u963b\u6b62\u3002\u662f\u5426\u7ee7\u7eed\uff1f",
        noTargetOverlap: "\u76ee\u6807\u8303\u56f4\u5185\u6ca1\u6709\u4e0e\u8be5\u65f6\u95f4\u6bb5\u76f8\u4ea4\u7684\u5df2\u542f\u7528\u753b\u9762\u56fe\u5c42\u3002\u7eaf\u97f3\u9891\u5c42\u4e0d\u53c2\u4e0e\u753b\u9762\u9884\u6e32\u67d3\u3002",
        noVisualTargets: "\u76ee\u6807\u8303\u56f4\u5185\u53ea\u6709\u7eaf\u97f3\u9891\u5c42\uff0c\u6ca1\u6709\u53ef\u9884\u6e32\u67d3\u7684\u753b\u9762\u56fe\u5c42\u3002\u97f3\u9891\u5c06\u4fdd\u6301\u539f\u6837\u3002",
        audioMemberBlocked: "\u8be5 PR \u7ec4\u5df2\u6709\u6210\u5458\u662f\u7eaf\u97f3\u9891\u5c42\uff0c\u53ef\u80fd\u7531\u65e7\u7248\u5f52\u7ec4\u6216\u66f4\u6362\u7d20\u6750\u9020\u6210\u3002\u4e3a\u4fdd\u62a4\u97f3\u9891\u548c\u5df2\u6709\u7247\u6bb5\uff0c\u6682\u4e0d\u7f16\u8f91\u6216\u66f4\u65b0\u6b64\u7ec4\u3002\u82e5\u6b63\u5728\u7f16\u8f91\uff0c\u53ef\u5148\u8fd4\u56de\u65e7\u7f13\u5b58\uff1b\u8bf7\u4ece\u9884\u6e32\u67d3\u524d\u7684\u5de5\u7a0b\u91cd\u65b0\u5efa\u7acb\u8be5\u7ec4\u3002\u65b0\u7248\u65b0\u5efa\u7ec4\u4f1a\u81ea\u52a8\u8df3\u8fc7\u7eaf\u97f3\u9891\u5c42\u3002",
        chooseTemplateFirst: "\u8bf7\u9009\u62e9\u8f93\u51fa\u6a21\u677f\u3002",
        folderCreateFailed: "\u65e0\u6cd5\u521b\u5efa\u8f93\u51fa\u76ee\u5f55\uff1a",
        unknownError: "\u53d1\u751f\u9519\u8bef\uff1a",
        management: "\u56fe\u5c42\u5173\u8054\u7ba1\u7406",
        selectRelated: "\u9009\u62e9\u5173\u8054\u56fe\u5c42",
        locateSource: "\u5b9a\u4f4d\u6e90\u56fe\u5c42",
        hideSources: "\u9690\u85cf\u6e90\u53c2\u8003\u5c42",
        showSources: "\u663e\u793a\u6e90\u53c2\u8003\u5c42",
        managementHint: "\u9009\u7f13\u5b58\u6216\u533a\u95f4\u6e90\u7247\u6bb5\u53ef\u5b9a\u4f4d\u540c\u7ec4\uff1b\u533a\u95f4\u5916\u7684\u5de5\u4f5c\u7247\u6bb5\u662f\u666e\u901a\u56fe\u5c42\uff0c\u4e0d\u53c2\u52a0\u5173\u8054\u7ba1\u7406\u3002",
        hideSourcesHint: "\u53ea\u9690\u85cf\u65f6\u95f4\u8f74\u884c\uff0c\u4e0d\u6539\u53d8\u753b\u9762\u5f00\u5173\u3002\u4f1a\u542f\u7528 AE \u5168\u5c40 Shy \u9690\u85cf\uff0c\u5176\u4ed6\u5df2\u6807\u8bb0 Shy \u7684\u56fe\u5c42\u4e5f\u4f1a\u9690\u85cf\u3002",
        showSourcesHint: "\u4ec5\u663e\u793a PR \u6e90\u53c2\u8003\u5c42\uff0c\u4e0d\u6253\u5f00\u753b\u9762\u5f00\u5173\uff0c\u4e5f\u4e0d\u663e\u793a\u5176\u4ed6 Shy \u56fe\u5c42\u3002",
        noAssociation: "\u8bf7\u5148\u5728\u5f53\u524d\u5408\u6210\u4e2d\u9009\u62e9\u5e26 PR \u5173\u8054\u7f16\u53f7\u7684\u7f13\u5b58\u6216\u533a\u95f4\u6e90\u7247\u6bb5\u3002",
        legacyAssociation: "\u6240\u9009\u56fe\u5c42\u542b\u65e7\u7248\u7ed3\u679c\uff0c\u7f3a\u5c11\u53ef\u9760\u7684\u7ec4\u7f16\u53f7\u548c\u540c\u6e90\u7f16\u53f7\uff0c\u4e0d\u80fd\u81ea\u52a8\u731c\u6d4b\u5173\u8054\u3002\u65e7\u7248\u6e90\u53c2\u8003\u5c42\u4ecd\u53ef\u9690\u85cf/\u663e\u793a\uff1b\u91cd\u65b0\u9884\u6e32\u67d3\u540e\u4f1a\u751f\u6210\u5b8c\u6574\u5173\u8054\u3002",
        noSourceRefs: "\u5f53\u524d\u8303\u56f4\u6ca1\u6709\u53ef\u5b9a\u4f4d\u7684\u6e90\u53c2\u8003\u5c42\u3002\u6574\u5408\u6210\u72ec\u7acb\u9884\u89c8\u6a21\u5f0f\u4e0d\u5728\u9884\u89c8\u5185\u4fdd\u7559\u539f\u56fe\u5c42\u3002",
        sourcesHidden: "\u5df2\u9690\u85cf PR \u6e90\u53c2\u8003\u5c42\uff08\u4ec5\u65f6\u95f4\u8f74\uff09\u3002AE \u5168\u5c40 Shy \u9690\u85cf\u5df2\u542f\u7528\uff1b\u5176\u4ed6\u5df2\u6807\u8bb0 Shy \u7684\u56fe\u5c42\u4e5f\u4f1a\u9690\u85cf\u3002",
        sourcesShown: "\u5df2\u663e\u793a PR \u6e90\u53c2\u8003\u5c42\uff08\u4ec5\u65f6\u95f4\u8f74\uff09\uff0c\u753b\u9762\u3001\u97f3\u9891\u548c\u9501\u5b9a\u72b6\u6001\u4fdd\u6301\u4e0d\u53d8\u3002",
        selectedRelated: "\u5df2\u9009\u62e9\u5173\u8054\u56fe\u5c42\uff1a",
        selectedSources: "\u5df2\u5b9a\u4f4d\u6e90\u56fe\u5c42\uff1a",
        roleBefore: "\u524d",
        roleAfter: "\u540e",
        roleCache: "\u7f13\u5b58",
        regularMode: "\u5e38\u89c4\u6a21\u5f0f",
        modifyMode: "\u4fee\u6539\u6a21\u5f0f",
        currentMode: "\u5f53\u524d\u6a21\u5f0f",
        regularModeHint: "\u7f13\u5b58\u533a\u95f4\u663e\u793a\u9884\u6e32\u67d3\u56fe\u5c42\uff1b\u533a\u95f4\u5916\u7684\u5de5\u4f5c\u7247\u6bb5\u4fdd\u6301\u53ef\u7f16\u8f91\u3002",
        modifyModeHint: "\u5173\u95ed\u672c\u5408\u6210\u7684 V2 \u7f13\u5b58\u5e76\u663e\u793a\u7f13\u5b58\u533a\u95f4\u5185\u7684\u6e90\u7247\u6bb5\uff1b\u66f4\u65b0\u6210\u529f\u540e\u81ea\u52a8\u8fd4\u56de\u5e38\u89c4\u6a21\u5f0f\u3002",
        modeRegularStatus: "\u5df2\u8fdb\u5165\u5e38\u89c4\u6a21\u5f0f\uff1a\u7f13\u5b58\u533a\u95f4\u4f7f\u7528\u9884\u6e32\u67d3\u753b\u9762\uff0c\u533a\u95f4\u5916\u5de5\u4f5c\u7247\u6bb5\u53ef\u7ee7\u7eed\u7f16\u8f91\u3002",
        modeModifyStatus: "\u5df2\u8fdb\u5165\u4fee\u6539\u6a21\u5f0f\uff1a\u7f13\u5b58\u6682\u65f6\u5173\u95ed\uff0c\u7f13\u5b58\u533a\u95f4\u5185\u6e90\u7247\u6bb5\u5df2\u663e\u793a\u3002\u8bf7\u9009\u62e9\u8981\u66f4\u65b0\u7684\u6e90\u7247\u6bb5\u3002",
        updateNeedsModifyMode: "\u8bf7\u5148\u8fdb\u5165\u4fee\u6539\u6a21\u5f0f\uff0c\u518d\u9009\u62e9\u9700\u8981\u66f4\u65b0\u7684\u7f13\u5b58\u533a\u95f4\u6e90\u7247\u6bb5\u3002",
        modeNoGroups: "\u5f53\u524d\u5408\u6210\u6ca1\u6709 V2 \u9884\u6e32\u67d3\u7ec4\u3002",
        modeMixed: "\u72b6\u6001\u5f02\u5e38",
        newRenderNeedsRegular: "\u8bf7\u5148\u8fd4\u56de\u5e38\u89c4\u6a21\u5f0f\uff0c\u518d\u521b\u5efa\u65b0\u7684\u9884\u6e32\u67d3\u65f6\u95f4\u5757\u3002",
        existingBlockOverlap: "\u76ee\u6807\u65f6\u95f4\u8303\u56f4\u4e0e\u5df2\u6709 V2 \u7f13\u5b58\u5757\u91cd\u53e0\u3002\u8bf7\u8fdb\u5165\u4fee\u6539\u6a21\u5f0f\u66f4\u65b0\u539f\u7f13\u5b58\uff0c\u6216\u9009\u62e9\u4e0d\u91cd\u53e0\u7684\u955c\u5934\u8303\u56f4\u3002",
        v1TargetBlocked: "\u76ee\u6807\u56fe\u5c42\u5305\u542b PreRendering V1 \u5173\u8054\u8bb0\u5f55\u3002V2 \u4e0d\u4f1a\u4fee\u6539 V1 \u7ed3\u679c\uff1b\u8bf7\u4f7f\u7528\u672a\u9884\u6e32\u67d3\u7684\u5de5\u4f5c\u56fe\u5c42\uff0c\u6216\u5728\u65b0\u5de5\u7a0b\u526f\u672c\u4e2d\u6d4b\u8bd5\u3002",
        editSources: "\u7f16\u8f91\u6e90\u56fe\u5c42",
        updateCache: "\u66f4\u65b0\u9884\u6e32\u67d3",
        returnCache: "\u8fd4\u56de\u65e7\u7f13\u5b58",
        editHint: "\u8bf7\u5148\u8fdb\u5165\u4fee\u6539\u6a21\u5f0f\u5e76\u7f16\u8f91\u7f13\u5b58\u533a\u95f4\u5185\u7684\u6e90\u7247\u6bb5\uff1b\u66f4\u65b0\u6cbf\u7528\u539f\u9884\u6e32\u67d3\u5bf9\u8c61\u548c\u65f6\u95f4\u8303\u56f4\uff0c\u5e76\u4f7f\u7528\u5f53\u524d\u8f93\u51fa\u6a21\u677f\u4e0e\u76ee\u5f55\u3002",
        editStarted: "\u5df2\u8fdb\u5165\u6e90\u56fe\u5c42\u7f16\u8f91\u3002\u7f13\u5b58\u548c\u65e7\u7247\u6bb5\u6682\u65f6\u5173\u95ed\uff1b\u4fee\u6539\u5b8c\u6210\u540e\u70b9\u51fb\u201c\u66f4\u65b0\u9884\u6e32\u67d3\u201d\u3002",
        editingAlready: "\u8be5\u7ec4\u5df2\u5728\u7f16\u8f91\u4e2d\uff0c\u53ef\u7ee7\u7eed\u4fee\u6539\u6216\u66f4\u65b0\u3002",
        returnedCache: "\u5df2\u8fd4\u56de\u65e7\u7f13\u5b58\u3002\u6e90\u56fe\u5c42\u4e0a\u7684\u4fee\u6539\u4ecd\u7136\u4fdd\u7559\uff0c\u65e7\u7f13\u5b58\u53ef\u80fd\u8fc7\u671f\uff1b\u8fd9\u4e0d\u662f\u64a4\u9500\u4fee\u6539\u3002",
        updatedCache: "\u5df2\u66f4\u65b0\u9884\u6e32\u67d3\u5e76\u8fd4\u56de\u5e38\u89c4\u6a21\u5f0f\uff1a",
        editChooseOne: "\u8bf7\u4ece\u540c\u4e00\u4e2a PR \u7ec4\u4e2d\u9009\u62e9\u7f13\u5b58\u6216\u533a\u95f4\u6e90\u7247\u6bb5\u3002",
        dependencyBlocked: "\u8be5\u7ec4\u4e0e\u5176\u4ed6\u9884\u6e32\u67d3\u7ec4\u5b58\u5728\u5d4c\u5957/\u91cd\u590d\u4f7f\u7528\u5173\u7cfb\uff0c\u6682\u4e0d\u80fd\u5b89\u5168\u5730\u5355\u72ec\u7f16\u8f91\u6216\u66f4\u65b0\u3002\u8bf7\u4f7f\u7528\u672a\u9884\u6e32\u67d3\u7684\u6e90\u5de5\u7a0b\u91cd\u65b0\u5efa\u7acb\u72ec\u7acb\u7ec4\u3002",
        brokenGroup: "PR \u7ec4\u8bb0\u5f55\u4e0d\u5b8c\u6574\u3001\u6210\u5458\u91cd\u590d\u6216\u56fe\u5c42\u5806\u6808\u53d1\u751f\u51b2\u7a81\uff0c\u8bf7\u68c0\u67e5\u533a\u95f4\u6e90\u7247\u6bb5\u548c\u7f13\u5b58\u3002\u4e0d\u80fd\u5b89\u5168\u66f4\u65b0\u3002",
        anotherEditing: "\u5f53\u524d\u5408\u6210\u5df2\u6709 PR \u7ec4\u5904\u4e8e\u7f16\u8f91\u4e2d\u3002\u8bf7\u5148\u66f4\u65b0\u8be5\u7ec4\u6216\u8fd4\u56de\u65e7\u7f13\u5b58\u3002",
        rangeChanged: "\u539f\u7ec4\u8bb0\u5f55\u7684\u65f6\u95f4\u8303\u56f4\u4e0e\u5f53\u524d\u5408\u6210\u6216\u7f13\u5b58\u5165\u51fa\u70b9\u4e0d\u4e00\u81f4\u3002\u8bf7\u6062\u590d\u539f\u8303\u56f4\uff0c\u6216\u91cd\u65b0\u521b\u5efa\u9884\u6e32\u67d3\u3002",
        fullEditUnsupported: "\u6574\u5408\u6210\u72ec\u7acb\u9884\u89c8\u6ca1\u6709\u6e90\u53c2\u8003\u5c42\uff0c\u8bf7\u6253\u5f00\u6e90\u5408\u6210\u4fee\u6539\u540e\u91cd\u65b0\u751f\u6210\u3002\u6b64\u529f\u80fd\u652f\u6301\u201c\u5e94\u7528\u5230\u539f\u5408\u6210\u201d\u548c\u5c40\u90e8\u72ec\u7acb\u9884\u89c8\u3002",
        formatMismatch: "\u65b0\u7f13\u5b58\u7684\u5c3a\u5bf8\u3001\u50cf\u7d20\u5bbd\u9ad8\u6bd4\u3001\u65f6\u957f\u6216\u5e27\u7387\u4e0e\u539f\u7f13\u5b58\u4e0d\u5339\u914d\u3002\u8bf7\u68c0\u67e5\u8f93\u51fa\u6a21\u677f\u7684\u7f29\u653e\u3001\u5e27\u7387\u7b49\u8bbe\u7f6e\uff1b\u65e7\u7ed3\u679c\u5c1a\u672a\u66ff\u6362\u3002",
        updateFailed: "\u66f4\u65b0\u672a\u5b8c\u6210\uff1b\u65e7\u7f13\u5b58\u6587\u4ef6\u4ecd\u4fdd\u7559\u3002\u5f53\u524d\u5408\u6210\u4f1a\u5c3d\u91cf\u505c\u7559\u5728\u4fee\u6539\u6a21\u5f0f\uff0c\u8bf7\u68c0\u67e5\u63d0\u793a\u540e\u91cd\u8bd5\u3002",
        returnNotEditing: "\u8be5\u7ec4\u4e0d\u5728\u7f16\u8f91\u72b6\u6001\uff0c\u65e0\u9700\u8fd4\u56de\u65e7\u7f13\u5b58\u3002",
        oldSegmentsWarning: "\u65b0\u7ed3\u679c\u5df2\u751f\u6548\uff0c\u4f46\u90e8\u5206\u65e7\u7247\u6bb5\u672a\u80fd\u79fb\u9664\uff0c\u5df2\u5173\u95ed\u753b\u9762\u5e76\u6807\u8bb0\u4e3a\u5f85\u6e05\u7406\uff1a",
        recoveryWarning: "\u56de\u9000\u64cd\u4f5c\u672a\u80fd\u5168\u90e8\u5b8c\u6210\uff0c\u8bf7\u64a4\u9500\u672c\u6b21\u66f4\u65b0\u5e76\u68c0\u67e5\u56fe\u5c42\uff1a"
    };

    function trimString(value) {
        return String(value || "").replace(/^\s+|\s+$/g, "");
    }

    function padNumber(value, length) {
        var text = String(value);
        while (text.length < length) {
            text = "0" + text;
        }
        return text;
    }

    function timestamp() {
        var now = new Date();
        return now.getFullYear() +
            padNumber(now.getMonth() + 1, 2) +
            padNumber(now.getDate(), 2) + "_" +
            padNumber(now.getHours(), 2) +
            padNumber(now.getMinutes(), 2) +
            padNumber(now.getSeconds(), 2);
    }

    function safeName(name) {
        var result = String(name || "Comp")
            .replace(/[\\\/:*?"<>|]/g, "_")
            .replace(/[\.\s]+$/g, "")
            .replace(/^\s+|\s+$/g, "");
        return result.length ? result : "Comp";
    }

    function secondsToFrame(comp, timeValue) {
        return Math.round((timeValue - comp.displayStartTime) / comp.frameDuration);
    }

    function frameLabel(comp, timeValue) {
        var frame = secondsToFrame(comp, timeValue);
        return (frame < 0 ? "m" : "") + padNumber(Math.abs(frame), 5);
    }

    function uniqueItemName(baseName) {
        var candidate = baseName;
        var suffix = 2;
        var exists = true;
        while (exists) {
            exists = false;
            for (var i = 1; i <= app.project.numItems; i++) {
                if (app.project.item(i).name === candidate) {
                    exists = true;
                    candidate = baseName + " " + suffix;
                    suffix++;
                    break;
                }
            }
        }
        return candidate;
    }

    function getActiveComp() {
        var item = app.project ? app.project.activeItem : null;
        return item && item instanceof CompItem ? item : null;
    }

    function defaultOutputFolder() {
        var baseFolder;
        if (app.project && app.project.file) {
            baseFolder = app.project.file.parent;
        } else {
            baseFolder = Folder.myDocuments;
        }
        return new Folder(baseFolder.fullName + "/" + File.encode(DEFAULT_CACHE_FOLDER));
    }

    function ensureFolder(folder) {
        if (!folder.exists && !folder.create()) {
            throw new Error(T.folderCreateFailed + "\n" + folder.fsName);
        }
        return folder;
    }

    function ensureProjectFolder() {
        var folderName = "_PreRenderingV2.0";
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);
            if (item instanceof FolderItem && item.name === folderName) {
                return item;
            }
        }
        return app.project.items.addFolder(folderName);
    }

    function selectedLayerIndices(comp) {
        var selected = comp.selectedLayers;
        var indices = [];
        for (var i = 0; i < selected.length; i++) {
            indices.push(selected[i].index);
        }
        indices.sort(function (a, b) { return a - b; });
        return indices;
    }

    function isAudioOnlyLayer(layer) {
        // Require both capabilities explicitly; do not guess from extensions or mute/eye switches.
        try { return layer.hasAudio === true && layer.hasVideo === false; }
        catch (ignoreAudioCapabilities) { return false; }
    }

    function withoutAudioOnlyLayers(comp, indices) {
        var filtered = [];
        for (var i = 0; i < indices.length; i++) {
            if (!isAudioOnlyLayer(comp.layer(indices[i]))) { filtered.push(indices[i]); }
        }
        return filtered;
    }

    function isContiguous(indices, comp) {
        if (!indices.length) {
            return false;
        }
        for (var i = 1; i < indices.length; i++) {
            for (var gap = indices[i - 1] + 1; gap < indices[i]; gap++) {
                if (!comp || !isAudioOnlyLayer(comp.layer(gap))) { return false; }
            }
        }
        return true;
    }

    function getTargetIndices(comp, scopeIndex) {
        var indices = [];
        var selected = selectedLayerIndices(comp);
        var i;

        if (scopeIndex === 0) {
            for (i = 1; i <= comp.numLayers; i++) {
                indices.push(i);
            }
            return withoutAudioOnlyLayers(comp, indices);
        }

        if (!selected.length) {
            throw new Error(T.selectLayer);
        }

        if (scopeIndex === 1) {
            selected = withoutAudioOnlyLayers(comp, selected);
            if (!selected.length) { return selected; }
            if (!isContiguous(selected, comp)) {
                throw new Error(T.contiguousOnly);
            }
            return selected;
        }

        for (i = selected[0]; i <= comp.numLayers; i++) {
            indices.push(i);
        }
        return withoutAudioOnlyLayers(comp, indices);
    }

    function alignRangeToFrames(comp, start, end) {
        var compStart = 0;
        var compEnd = comp.duration;
        var fd = comp.frameDuration;
        var epsilon = fd / 1000;

        start = Math.max(compStart, start);
        end = Math.min(compEnd, end);
        start = compStart + Math.floor(((start - compStart) / fd) + epsilon) * fd;
        end = compStart + Math.ceil(((end - compStart) / fd) - epsilon) * fd;
        start = Math.max(compStart, start);
        end = Math.min(compEnd, end);

        if (end - start < fd - epsilon) {
            throw new Error(T.invalidRange);
        }

        return {
            start: start,
            end: end,
            duration: end - start
        };
    }

    function getRange(comp, rangeIndex) {
        var start;
        var end;

        if (rangeIndex === 0) {
            start = comp.workAreaStart;
            end = start + comp.workAreaDuration;
        } else if (rangeIndex === 1) {
            start = 0;
            end = comp.duration;
        } else if (rangeIndex === 2) {
            var selected = comp.selectedLayers;
            if (!selected.length) {
                throw new Error(T.selectLayer);
            }
            start = selected[0].inPoint;
            end = selected[0].outPoint;
            for (var i = 1; i < selected.length; i++) {
                start = Math.min(start, selected[i].inPoint);
                end = Math.max(end, selected[i].outPoint);
            }
        } else {
            var markerInfo = findRangeMarker(comp);
            if (!markerInfo) {
                throw new Error(T.rangeMarkerMissing);
            }
            if (markerInfo.count > 1) {
                throw new Error(T.rangeMarkerMultiple);
            }
            if (markerInfo.value.duration < comp.frameDuration / 2) {
                throw new Error(T.rangeMarkerZero);
            }
            start = markerInfo.time;
            end = start + markerInfo.value.duration;
        }

        return alignRangeToFrames(comp, start, end);
    }

    function targetHasOverlap(comp, targetIndices, range) {
        var epsilon = comp.frameDuration / 100;
        for (var i = 0; i < targetIndices.length; i++) {
            var layer = comp.layer(targetIndices[i]);
            if (isAudioOnlyLayer(layer)) { continue; }
            var enabled = false;
            try { enabled = layer.enabled; } catch (ignoreEnabled) {}
            if (enabled && layer.outPoint > range.start + epsilon && layer.inPoint < range.end - epsilon) {
                return true;
            }
        }
        return false;
    }

    function targetHasManagedOverlap(comp, targetIndices, range) {
        var epsilon = comp.frameDuration / 100;
        var i;
        for (i = 1; i <= comp.numLayers; i++) {
            var managedLayer = comp.layer(i);
            var managedRecord = latestLayerMetadata(managedLayer);
            if (hasAssociation(managedRecord) && managedRecord.kind === "cache" &&
                    managedLayer.outPoint > range.start + epsilon &&
                    managedLayer.inPoint < range.end - epsilon) {
                return true;
            }
        }
        for (i = 0; i < targetIndices.length; i++) {
            var layer = comp.layer(targetIndices[i]);
            var record = latestLayerMetadata(layer);
            if (hasAssociation(record) &&
                    layer.outPoint > range.start + epsilon && layer.inPoint < range.end - epsilon) {
                return true;
            }
            var comment = "";
            try { comment = String(layer.comment || ""); } catch (ignoreComment) {}
            if (comment.indexOf("PreRenderingV1|") >= 0 &&
                    layer.outPoint > range.start + epsilon && layer.inPoint < range.end - epsilon) {
                throw new Error(T.v1TargetBlocked);
            }
        }
        return false;
    }

    function getCompMarkerProperty(comp) {
        var markerProperty = null;
        try { markerProperty = comp.markerProperty; } catch (ignoreMarkerProperty) {}
        if (!markerProperty) {
            throw new Error(T.markerUnsupported);
        }
        return markerProperty;
    }

    function findRangeMarker(comp) {
        var markerProperty = getCompMarkerProperty(comp);
        var found = null;
        var count = 0;
        for (var i = 1; i <= markerProperty.numKeys; i++) {
            var markerValue = markerProperty.keyValue(i);
            if (markerValue.comment === RANGE_MARKER_COMMENT) {
                count++;
                if (!found) {
                    found = {
                        property: markerProperty,
                        keyIndex: i,
                        time: markerProperty.keyTime(i),
                        value: markerValue,
                        count: 0
                    };
                }
            }
        }
        if (found) {
            found.count = count;
        }
        return found;
    }

    function markerExistsAtTime(markerProperty, timeValue, epsilon) {
        for (var i = 1; i <= markerProperty.numKeys; i++) {
            if (Math.abs(markerProperty.keyTime(i) - timeValue) <= epsilon) {
                return true;
            }
        }
        return false;
    }

    function createOrRevealRangeMarker() {
        var comp = getActiveComp();
        var markerUndoOpen = false;
        if (!comp) {
            if (state.bridgeMode) { throw new Error(T.noComp); }
            alert(T.noComp, SCRIPT_NAME); return;
        }

        try {
            var existing = findRangeMarker(comp);
            if (existing) {
                if (existing.count > 1) {
                    throw new Error(T.rangeMarkerMultiple);
                }
                comp.time = existing.time;
                state.panel.rangeDropdown.selection = 3;
                setStatus(T.rangeMarkerExists);
                return;
            }

            var markerProperty = getCompMarkerProperty(comp);
            var compStart = 0;
            var compEnd = comp.duration;
            var markerStart = Number(comp.time);
            if (!isFinite(markerStart)) { markerStart = compStart; }
            markerStart = Math.max(compStart, Math.min(compEnd, markerStart));
            var markerEnd = Math.min(markerStart + 1, compEnd);
            if (markerEnd - markerStart < comp.frameDuration / 2) {
                throw new Error(T.rangeMarkerAtEnd);
            }
            var range = {
                start: markerStart,
                end: markerEnd,
                duration: markerEnd - markerStart
            };
            if (markerExistsAtTime(markerProperty, range.start, comp.frameDuration / 100)) {
                throw new Error(T.rangeMarkerCollision);
            }

            app.beginUndoGroup(SCRIPT_NAME + " - Create Range Marker");
            markerUndoOpen = true;
            var markerValue = new MarkerValue(RANGE_MARKER_COMMENT);
            markerValue.duration = range.duration;
            markerProperty.setValueAtTime(range.start, markerValue);
            comp.time = range.start;
            app.endUndoGroup();
            markerUndoOpen = false;

            state.panel.rangeDropdown.selection = 3;
            setStatus(T.rangeMarkerCreated);
        } catch (markerError) {
            if (markerUndoOpen) {
                try { app.endUndoGroup(); } catch (ignoreEndMarkerGroup) {}
            }
            if (state.bridgeMode) { throw markerError; }
            alert(markerError.message || String(markerError), SCRIPT_NAME);
        }
    }

    function isCameraOrLight(layer) {
        return (typeof CameraLayer !== "undefined" && layer instanceof CameraLayer) ||
            (typeof LightLayer !== "undefined" && layer instanceof LightLayer);
    }

    function hasAnySolo(comp) {
        for (var i = 1; i <= comp.numLayers; i++) {
            if (comp.layer(i).solo) {
                return true;
            }
        }
        return false;
    }

    function hasAppliedResultLayers(comp) {
        for (var i = 1; i <= comp.numLayers; i++) {
            var comment = "";
            try { comment = String(comp.layer(i).comment || ""); } catch (ignoreComment) {}
            if (comment.indexOf(META_PREFIX) >= 0 && comment.indexOf(";mode=applied") >= 0) {
                return true;
            }
        }
        return false;
    }

    function layerUsesTrackMatte(layer) {
        try {
            if (layer.hasTrackMatte) {
                return true;
            }
        } catch (ignoreHasTrackMatte) {}
        try {
            if (layer.isTrackMatte) {
                return true;
            }
        } catch (ignoreIsTrackMatte) {}
        return false;
    }

    function collectRisks(comp, targetIndices, scopeIndex) {
        var risks = [];
        var targetMap = {};
        var targetHas3D = false;
        var outsideHas3D = false;
        var adjustmentRisk = false;
        var trackMatteRisk = false;
        var collapseRisk = false;
        var blendModeRisk = false;
        var i;

        if (scopeIndex === 0) {
            return risks;
        }

        for (i = 0; i < targetIndices.length; i++) {
            targetMap[targetIndices[i]] = true;
        }

        for (i = 1; i <= comp.numLayers; i++) {
            var layer = comp.layer(i);
            var isTarget = !!targetMap[i];
            var is3D = false;
            try { is3D = !!layer.threeDLayer; } catch (ignore3D) {}

            if (isTarget && is3D) {
                targetHas3D = true;
            } else if (!isTarget && is3D) {
                outsideHas3D = true;
            }

            if (isTarget) {
                try {
                    if (layer.adjustmentLayer && targetIndices[targetIndices.length - 1] < comp.numLayers) {
                        adjustmentRisk = true;
                    }
                } catch (ignoreAdjustment) {}
                if (layerUsesTrackMatte(layer)) {
                    trackMatteRisk = true;
                }
                try {
                    if (layer.collapseTransformation) {
                        collapseRisk = true;
                    }
                } catch (ignoreCollapse) {}
                if (targetIndices.length > 1) {
                    try {
                        if (layer.blendingMode !== BlendingMode.NORMAL) {
                            blendModeRisk = true;
                        }
                    } catch (ignoreBlendMode) {}
                }
            }
        }

        if (trackMatteRisk) { risks.push(T.issueTrackMatte); }
        if (adjustmentRisk) { risks.push(T.issueAdjustment); }
        if (targetHas3D && outsideHas3D) { risks.push(T.issue3D); }
        if (collapseRisk) { risks.push(T.issueCollapse); }
        if (blendModeRisk) { risks.push(T.issueBlendMode); }

        return risks;
    }

    function confirmRisks(comp, targetIndices, scopeIndex, resultModeIndex) {
        if (hasAnySolo(comp)) {
            if (resultModeIndex === 0) {
                if (state.bridgeMode) { throw new Error(T.soloApplyBlocked); }
                alert(T.soloApplyBlocked, SCRIPT_NAME); return false;
            }
            if (scopeIndex !== 0) {
                if (state.bridgeMode) { throw new Error(T.soloBlocked); }
                alert(T.soloBlocked, SCRIPT_NAME); return false;
            }
        }

        if (state.bridgeMode && state.risksConfirmed) { return true; }

        if (scopeIndex !== 0 && !confirm(T.alphaWarning)) {
            return false;
        }

        var risks = collectRisks(comp, targetIndices, scopeIndex);
        if (!risks.length) {
            return true;
        }

        var message = T.riskWarning;
        for (var i = 0; i < risks.length; i++) {
            message += "\u2022 " + risks[i] + "\n";
        }
        message += T.continueQuestion;
        return confirm(message);
    }

    function snapshotProjectItemIds() {
        var ids = {};
        for (var i = 1; i <= app.project.numItems; i++) {
            ids[String(app.project.item(i).id)] = true;
        }
        return ids;
    }

    function findNewFootageItem(previousIds) {
        var newest = null;
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);
            if (!previousIds[String(item.id)] && item instanceof FootageItem) {
                newest = item;
            }
        }
        return newest;
    }

    function outputExtensionFromModule(outputModule) {
        var defaultName = "";
        try {
            if (outputModule.file) {
                defaultName = outputModule.file.name;
            }
        } catch (ignoreFile) {}

        var match = defaultName.match(/(\.[^\.\\\/]+)$/);
        return match ? match[1] : "";
    }

    function createOutputFile(folder, sourceComp, range, outputModule) {
        var extension = outputExtensionFromModule(outputModule);
        var sequenceToken = "";
        try {
            if (outputModule.file) {
                var tokenMatch = outputModule.file.name.match(/(\[#+\])/);
                sequenceToken = tokenMatch ? "_" + tokenMatch[1] : "";
            }
        } catch (ignoreSequenceToken) {}
        var fileName = safeName(sourceComp.name) +
            "_PR_" + frameLabel(sourceComp, range.start) +
            "-" + frameLabel(sourceComp, range.end) +
            "_" + timestamp() + "_" + padNumber(new Date().getMilliseconds(), 3);
        fileName = uniqueOutputStem(folder, fileName) + sequenceToken + extension;
        return new File(folder.fullName + "/" + File.encode(fileName));
    }

    function uniqueOutputStem(folder, stem) {
        var entries = folder.getFiles();
        var candidate = stem;
        var suffix = 1;
        var conflict = true;
        while (conflict) {
            conflict = false;
            for (var i = 0; i < entries.length; i++) {
                var name = File.decode(entries[i].name);
                if (name.indexOf(candidate) === 0) {
                    conflict = true;
                    candidate = stem + "_v" + padNumber(++suffix, 2);
                    break;
                }
            }
        }
        return candidate;
    }

    function makeRenderComp(sourceComp, targetIndices, scopeIndex, projectFolder) {
        if (scopeIndex === 0) {
            return {
                comp: sourceComp,
                temporary: false
            };
        }

        var renderComp = sourceComp.duplicate();
        renderComp.name = uniqueItemName("__PR_RENDER__ " + sourceComp.name);
        renderComp.parentFolder = projectFolder;

        var targetMap = {};
        var targetHas3D = false;
        var i;
        for (i = 0; i < targetIndices.length; i++) {
            targetMap[targetIndices[i]] = true;
            try {
                if (sourceComp.layer(targetIndices[i]).threeDLayer) {
                    targetHas3D = true;
                }
            } catch (ignoreTarget3D) {}
        }

        for (i = 1; i <= renderComp.numLayers; i++) {
            var layer = renderComp.layer(i);
            // Keep audio dependencies available, even outside the visual target range.
            if (isAudioOnlyLayer(layer)) { continue; }
            if (!targetMap[i] && !(targetHas3D && isCameraOrLight(layer))) {
                try { layer.enabled = false; } catch (ignoreEnabled) {}
                try { layer.audioEnabled = false; } catch (ignoreAudio) {}
            }
        }

        return {
            comp: renderComp,
            temporary: true
        };
    }

    function copyCompSettings(sourceComp, targetComp) {
        try { targetComp.displayStartTime = sourceComp.displayStartTime; } catch (ignoreStart) {}
        try { targetComp.renderer = sourceComp.renderer; } catch (ignoreRenderer) {}
        try { targetComp.bgColor = sourceComp.bgColor; } catch (ignoreBg) {}
        try { targetComp.shutterAngle = sourceComp.shutterAngle; } catch (ignoreShutter) {}
        try { targetComp.shutterPhase = sourceComp.shutterPhase; } catch (ignorePhase) {}
        try { targetComp.motionBlur = sourceComp.motionBlur; } catch (ignoreMotionBlur) {}
        try { targetComp.frameBlending = sourceComp.frameBlending; } catch (ignoreFrameBlend) {}
        try { targetComp.preserveNestedFrameRate = sourceComp.preserveNestedFrameRate; } catch (ignoreFrameRate) {}
        try { targetComp.preserveNestedResolution = sourceComp.preserveNestedResolution; } catch (ignoreResolution) {}
    }

    function addSourceSegment(previewComp, sourceComp, inPoint, outPoint, layerName) {
        if (outPoint - inPoint < sourceComp.frameDuration / 2) {
            return null;
        }
        var layer = previewComp.layers.add(sourceComp);
        layer.name = layerName;
        layer.startTime = 0;
        layer.inPoint = inPoint;
        layer.outPoint = outPoint;
        return layer;
    }

    function buildFullCompPreview(sourceComp, footageItem, range, projectFolder) {
        var group = createAssociationGroup(sourceComp, range, "full", 0);
        var preview = app.project.items.addComp(
            uniqueItemName(sourceComp.name + " [PR]"),
            sourceComp.width,
            sourceComp.height,
            sourceComp.pixelAspect,
            sourceComp.duration,
            sourceComp.frameRate
        );
        preview.parentFolder = projectFolder;
        copyCompSettings(sourceComp, preview);

        var compStart = sourceComp.displayStartTime;
        var compEnd = compStart + sourceComp.duration;
        var before = addSourceSegment(preview, sourceComp, compStart, range.start,
            liveSegmentName(group, "L01", "liveBefore", sourceComp.name));
        var after = addSourceSegment(preview, sourceComp, range.end, compEnd,
            liveSegmentName(group, "L01", "liveAfter", sourceComp.name));
        if (before) { tagManagedLayer(before, group, "L01", "liveBefore"); }
        if (after) { tagManagedLayer(after, group, "L01", "liveAfter"); }

        var cacheLayer = addCacheLayer(preview, footageItem, sourceComp, [], 0, range, null, group);
        state.lastGroupId = group.id;
        return preview;
    }

    function appendLayerMetadata(layer, metadata) {
        var existing = "";
        existing = String(layer.comment || "");
        layer.comment = existing ? existing + "\n" + metadata : metadata;
    }

    function parseMetadataLine(line) {
        if (line.indexOf(META_PREFIX) !== 0) {
            return null;
        }
        var fields = line.substring(META_PREFIX.length).split(";");
        var record = {};
        for (var i = 0; i < fields.length; i++) {
            var separator = fields[i].indexOf("=");
            if (separator < 1) {
                continue;
            }
            var key = fields[i].substring(0, separator);
            if (/^(schema|group|member|members|kind|source|start|end|mode|label|scope|previousLabel|previousShy|previousLocked|segmentIn|segmentOut|editing|eEnabled|eLocked|eShy|liveEnabled|draftEnabled|stale)$/.test(key)) {
                record[key] = fields[i].substring(separator + 1);
            }
        }
        if (!/^\d+$/.test(record.source || "") || !/^(applied|partial|partialPreview|full)$/.test(record.mode || "")) {
            return null;
        }
        return record;
    }

    function readLayerMetadata(layer) {
        var lines = String(layer.comment || "").split(/\r\n|\n|\r/);
        var records = [];
        for (var i = 0; i < lines.length; i++) {
            var record = parseMetadataLine(lines[i]);
            if (record) {
                records.push(record);
            }
        }
        return records;
    }

    function latestLayerMetadata(layer) {
        var records = readLayerMetadata(layer);
        return records.length ? records[records.length - 1] : null;
    }

    function hasAssociation(record) {
        return record && record.schema === "2" && /^PR\d+$/.test(record.group || "") &&
            /^(sourceRef|liveBefore|liveAfter|cache)$/.test(record.kind || "") &&
            (record.kind === "cache" || /^L\d+$/.test(record.member || ""));
    }

    function removeInheritedMetadata(layer) {
        var lines = String(layer.comment || "").split(/\r\n|\n|\r/);
        var kept = [];
        for (var i = 0; i < lines.length; i++) {
            if (!parseMetadataLine(lines[i])) {
                kept.push(lines[i]);
            }
        }
        layer.comment = kept.join("\n");
    }

    function createAssociationGroup(sourceComp, range, modeName, scopeIndex) {
        var highest = 0;
        for (var i = 1; i <= app.project.numItems; i++) {
            var item = app.project.item(i);
            if (!(item instanceof CompItem)) {
                continue;
            }
            for (var j = 1; j <= item.numLayers; j++) {
                var records = readLayerMetadata(item.layer(j));
                for (var k = 0; k < records.length; k++) {
                    if (hasAssociation(records[k])) {
                        highest = Math.max(highest, parseInt(records[k].group.substring(2), 10));
                    }
                }
            }
        }
        var number = highest + 1;
        return {
            id: "PR" + padNumber(number, 2),
            label: GROUP_LABELS[(number - 1) % GROUP_LABELS.length],
            sourceId: sourceComp.id,
            start: range.start,
            end: range.end,
            mode: modeName,
            scope: typeof scopeIndex === "number" ? scopeIndex : 0,
            members: []
        };
    }

    function associationMetadata(group, member, kind) {
        return META_PREFIX + "source=" + group.sourceId +
            ";start=" + group.start + ";end=" + group.end + ";mode=" + group.mode +
            ";schema=2;group=" + group.id + ";member=" + member + ";kind=" + kind +
            ";label=" + group.label + (group.scope !== null ? ";scope=" + group.scope : "") +
            (kind === "cache" ? ";members=" + group.members.join(",") : "");
    }

    function liveSegmentName(group, member, kind, originalName) {
        return "[" + group.id + "-" + member + " " +
            (kind === "liveBefore" ? T.roleBefore : T.roleAfter) + "] " + originalName;
    }

    function tagManagedLayer(layer, group, member, kind, extra) {
        appendLayerMetadata(layer, associationMetadata(group, member, kind) + (extra || ""));
        layer.label = group.label;
    }

    function withUnlockedLayer(layer, action) {
        var wasLocked = layer.locked;
        if (wasLocked) {
            layer.locked = false;
        }
        try {
            action(layer);
        } finally {
            if (wasLocked) {
                layer.locked = true;
            }
        }
    }

    function managementUndo(action) {
        app.beginUndoGroup(SCRIPT_NAME + " - Layer Management");
        try {
            action();
        } finally {
            app.endUndoGroup();
        }
    }

    function getCompositionMode(comp) {
        var lines = String(comp.comment || "").split(/\r\n|\n|\r/);
        for (var i = lines.length - 1; i >= 0; i--) {
            if (lines[i].indexOf(MODE_PREFIX) === 0) {
                return lines[i].substring(MODE_PREFIX.length) === "modify" ? "modify" : "regular";
            }
        }
        return "regular";
    }

    function writeCompositionMode(comp, mode) {
        var lines = String(comp.comment || "").split(/\r\n|\n|\r/);
        var kept = [];
        for (var i = 0; i < lines.length; i++) {
            if (lines[i] && lines[i].indexOf(MODE_PREFIX) !== 0) { kept.push(lines[i]); }
        }
        kept.push(MODE_PREFIX + (mode === "modify" ? "modify" : "regular"));
        comp.comment = kept.join("\n");
    }

    function compositionModeGroups(comp) {
        var groups = {};
        for (var i = 1; i <= comp.numLayers; i++) {
            var layer = comp.layer(i);
            var record = latestLayerMetadata(layer);
            if (!hasAssociation(record) || record.mode === "full" ||
                    (record.kind !== "sourceRef" && record.kind !== "cache")) { continue; }
            if (!groups[record.group]) { groups[record.group] = { sources: [], cache: null }; }
            var entry = { layer: layer, record: record };
            if (record.kind === "sourceRef") { groups[record.group].sources.push(entry); }
            else { groups[record.group].cache = entry; }
        }
        for (var id in groups) {
            if (groups.hasOwnProperty(id) && (!groups[id].cache || !groups[id].sources.length)) {
                delete groups[id];
            }
        }
        return groups;
    }

    function modeGroupCount(groups) {
        var count = 0;
        for (var id in groups) { if (groups.hasOwnProperty(id)) { count++; } }
        return count;
    }

    function preferredModeGroup(comp, groups) {
        var selectedId = "";
        var selected = comp.selectedLayers;
        for (var i = 0; i < selected.length; i++) {
            var record = latestLayerMetadata(selected[i]);
            if (!hasAssociation(record) || !groups[record.group]) { continue; }
            if (selectedId && selectedId !== record.group) { return ""; }
            selectedId = record.group;
        }
        if (selectedId) { return selectedId; }
        if (state.lastGroupId && groups[state.lastGroupId]) { return state.lastGroupId; }
        var atTime = "";
        var currentTime = Number(comp.time);
        if (isFinite(currentTime)) {
            for (var id in groups) {
                if (!groups.hasOwnProperty(id)) { continue; }
                var recordAtTime = groups[id].cache.record;
                if (currentTime >= Number(recordAtTime.start) && currentTime < Number(recordAtTime.end)) {
                    if (atTime) { return ""; }
                    atTime = id;
                }
            }
        }
        if (atTime) { return atTime; }
        if (modeGroupCount(groups) === 1) {
            for (id in groups) { if (groups.hasOwnProperty(id)) { return id; } }
        }
        return "";
    }

    function setCompositionMode(comp, mode, freshGroupId) {
        var groups = compositionModeGroups(comp);
        if (!modeGroupCount(groups)) { throw new Error(T.modeNoGroups); }
        var previousMode = getCompositionMode(comp);
        var focus = preferredModeGroup(comp, groups);
        var entries = [];
        for (var id in groups) {
            if (!groups.hasOwnProperty(id)) { continue; }
            entries.push(groups[id].cache);
            entries = entries.concat(groups[id].sources);
        }
        var snapshots = captureLayerSnapshots(entries);
        var previousComment = comp.comment;
        managementUndo(function () {
            try {
                for (var i = 0; i < entries.length; i++) {
                    var entry = entries[i];
                    var layer = entry.layer;
                    layer.locked = false;
                    if (mode === "modify") {
                        if (entry.record.kind === "cache") {
                            layer.enabled = false;
                            layer.selected = false;
                            layer.locked = true;
                        } else {
                            layer.enabled = previousMode === "modify" ? layer.enabled :
                                desiredSourceEnabled(entry, false);
                            layer.shy = false;
                            layer.selected = entry.record.group === focus;
                            layer.locked = false;
                        }
                    } else if (entry.record.kind === "cache") {
                        var cacheChanges = {};
                        if (entry.record.group === freshGroupId) { cacheChanges.stale = null; }
                        else if (previousMode === "modify") { cacheChanges.stale = "1"; }
                        writeGroupMetadata(layer, entry.record.group, cacheChanges);
                        layer.enabled = true;
                        layer.shy = false;
                        layer.selected = entry.record.group === (freshGroupId || focus);
                        layer.locked = true;
                    } else {
                        var changes = {};
                        if (previousMode === "modify") {
                            changes.draftEnabled = layer.enabled ? "1" : "0";
                        }
                        if (entry.record.group === freshGroupId) {
                            changes.draftEnabled = null;
                        }
                        writeGroupMetadata(layer, entry.record.group, changes);
                        layer.enabled = false;
                        layer.shy = true;
                        layer.selected = false;
                        layer.locked = true;
                    }
                }
                writeCompositionMode(comp, mode);
                if (focus) { state.lastGroupId = focus; }
            } catch (error) {
                comp.comment = previousComment;
                var recovery = restoreLayerSnapshots(snapshots);
                throw new Error((error.message || String(error)) +
                    (recovery.length ? "\n" + T.recoveryWarning + recovery.join("\n") : ""));
            }
        });
        return focus;
    }

    function switchCompositionMode(mode) {
        try {
            var comp = requireManagementComp();
            if (hasAnySolo(comp)) { throw new Error(T.soloApplyBlocked); }
            var focus = setCompositionMode(comp, mode, "");
            setStatus((mode === "modify" ? T.modeModifyStatus : T.modeRegularStatus) +
                (focus ? "\n" + focus : ""));
        } catch (error) { if (state.bridgeMode) { throw error; } alert(error.message || String(error), SCRIPT_NAME); }
    }

    function associationRequests(selectedLayers) {
        var requests = [];
        for (var i = 0; i < selectedLayers.length; i++) {
            var record = latestLayerMetadata(selectedLayers[i]);
            if (!record) {
                continue;
            }
            if (!hasAssociation(record)) {
                throw new Error(T.legacyAssociation);
            }
            requests.push({
                group: record.group,
                member: record.kind === "cache" ? "" : record.member
            });
        }
        if (!requests.length) {
            throw new Error(T.noAssociation);
        }
        return requests;
    }

    function findAssociatedLayers(comp, requests, sourcesOnly) {
        var matches = [];
        for (var i = 1; i <= comp.numLayers; i++) {
            var layer = comp.layer(i);
            var records = readLayerMetadata(layer);
            var matchesLayer = false;
            for (var j = 0; j < records.length && !matchesLayer; j++) {
                var record = records[j];
                if (!hasAssociation(record) || (sourcesOnly && record.kind !== "sourceRef")) {
                    continue;
                }
                for (var k = 0; k < requests.length; k++) {
                    var request = requests[k];
                    if (record.group === request.group && (!request.member ||
                        record.member === request.member || (!sourcesOnly && record.kind === "cache"))) {
                        matchesLayer = true;
                        break;
                    }
                }
            }
            if (matchesLayer) {
                matches.push(layer);
            }
        }
        return matches;
    }

    function sourceReferenceLayers(comp) {
        var references = [];
        for (var i = 1; i <= comp.numLayers; i++) {
            var layer = comp.layer(i);
            var record = latestLayerMetadata(layer);
            if (record && record.kind === "sourceRef") {
                references.push(layer);
            }
        }
        return references;
    }

    function requireManagementComp() {
        var comp = getActiveComp();
        if (!comp) {
            throw new Error(T.noComp);
        }
        if (app.project.renderQueue.rendering) {
            throw new Error(T.projectRendering);
        }
        return comp;
    }

    function selectAssociatedLayers(sourcesOnly) {
        try {
            var comp = requireManagementComp();
            var requests = associationRequests(comp.selectedLayers);
            var matches = findAssociatedLayers(comp, requests, sourcesOnly);
            if (!matches.length) {
                throw new Error(sourcesOnly ? T.noSourceRefs : T.noAssociation);
            }
            managementUndo(function () {
                for (var i = 1; i <= comp.numLayers; i++) {
                    if (comp.layer(i).selected) {
                        withUnlockedLayer(comp.layer(i), function (layer) { layer.selected = false; });
                    }
                }
                for (var j = 0; j < matches.length; j++) {
                    withUnlockedLayer(matches[j], function (layer) {
                        layer.shy = false;
                        layer.selected = true;
                    });
                }
            });
            setStatus((sourcesOnly ? T.selectedSources : T.selectedRelated) + matches.length +
                "\n" + requests[0].group + (requests[0].member ? "-" + requests[0].member : ""));
        } catch (managementError) {
            if (state.bridgeMode) { throw managementError; }
            alert(managementError.message || String(managementError), SCRIPT_NAME);
        }
    }

    function setSourceReferencesVisible(visible) {
        try {
            var comp = requireManagementComp();
            var references = sourceReferenceLayers(comp);
            if (!references.length) {
                throw new Error(T.noSourceRefs);
            }
            managementUndo(function () {
                for (var i = 0; i < references.length; i++) {
                    withUnlockedLayer(references[i], function (layer) { layer.shy = !visible; });
                }
                if (!visible) {
                    comp.hideShyLayers = true;
                }
            });
            setStatus((visible ? T.sourcesShown : T.sourcesHidden) + "\n" + references.length);
        } catch (managementError) {
            if (state.bridgeMode) { throw managementError; }
            alert(managementError.message || String(managementError), SCRIPT_NAME);
        }
    }

    function writeGroupMetadata(layer, groupId, changes) {
        var lines = String(layer.comment || "").split(/\r\n|\n|\r/);
        var found = false;
        for (var i = 0; i < lines.length; i++) {
            var record = parseMetadataLine(lines[i]);
            if (!record || record.group !== groupId) { continue; }
            found = true;
            var key;
            for (key in changes) {
                if (changes.hasOwnProperty(key)) {
                    if (changes[key] === null) { delete record[key]; }
                    else { record[key] = String(changes[key]); }
                }
            }
            var fields = [];
            for (key in record) {
                if (record.hasOwnProperty(key)) { fields.push(key + "=" + record[key]); }
            }
            lines[i] = META_PREFIX + fields.join(";");
        }
        if (!found) { throw new Error(T.brokenGroup); }
        layer.comment = lines.join("\n");
    }

    function editingGroupIds(comp) {
        var ids = [];
        var seen = {};
        for (var i = 1; i <= comp.numLayers; i++) {
            var records = readLayerMetadata(comp.layer(i));
            for (var j = 0; j < records.length; j++) {
                var record = records[j];
                if (hasAssociation(record) && record.editing === "1" && !seen[record.group]) {
                    seen[record.group] = true;
                    ids.push(record.group);
                }
            }
        }
        return ids;
    }

    function selectedEditableGroupId(comp) {
        var id = "";
        var selected = comp.selectedLayers;
        for (var i = 0; i < selected.length; i++) {
            var record = latestLayerMetadata(selected[i]);
            if (!record) { continue; }
            if (!hasAssociation(record)) { throw new Error(T.legacyAssociation); }
            if (id && id !== record.group) { throw new Error(T.editChooseOne); }
            id = record.group;
        }
        var editing = editingGroupIds(comp);
        if (!id && editing.length === 1) { id = editing[0]; }
        if (!id && getCompositionMode(comp) === "modify") {
            id = preferredModeGroup(comp, compositionModeGroups(comp));
        }
        if (!id) { throw new Error(T.editChooseOne); }
        if (editing.length && (editing.length !== 1 || editing[0] !== id)) {
            throw new Error(T.anotherEditing);
        }
        return id;
    }

    function describeEditableGroup(comp, id, returning) {
        var info = { comp: comp, id: id, entries: [], sources: [], lives: [], cache: null };
        var sourceMembers = {};
        var liveKeys = {};
        var layerIndices = {};
        for (var i = 1; i <= comp.numLayers; i++) {
            var layer = comp.layer(i);
            var records = readLayerMetadata(layer);
            var own = null;
            var other = false;
            for (var j = 0; j < records.length; j++) {
                if (!hasAssociation(records[j])) { continue; }
                if (records[j].group === id) {
                    if (own) { throw new Error(T.brokenGroup); }
                    own = records[j];
                } else { other = true; }
            }
            if (!own) { continue; }
            // Old metadata cannot tell us the audio layer's original lock state reliably.
            // Allow leaving an existing edit, but never silently migrate/delete its members.
            if (!returning && isAudioOnlyLayer(layer)) { throw new Error(T.audioMemberBlocked); }
            if (other) { throw new Error(T.dependencyBlocked); }
            var entry = { layer: layer, record: own };
            info.entries.push(entry);
            layerIndices[i] = true;
            if (own.kind === "cache") {
                if (info.cache) { throw new Error(T.brokenGroup); }
                info.cache = entry;
            } else if (own.kind === "sourceRef") {
                if (sourceMembers[own.member]) { throw new Error(T.brokenGroup); }
                sourceMembers[own.member] = true;
                info.sources.push(entry);
            } else {
                var liveKey = own.member + "_" + own.kind;
                if (liveKeys[liveKey]) { throw new Error(T.brokenGroup); }
                liveKeys[liveKey] = true;
                info.lives.push(entry);
            }
        }
        if (!info.cache) { throw new Error(T.brokenGroup); }
        var cacheRecord = info.cache.record;
        if (cacheRecord.mode === "full") { throw new Error(T.fullEditUnsupported); }
        if (!info.sources.length) { throw new Error(T.brokenGroup); }
        if (info.lives.length) { throw new Error(T.brokenGroup); }
        for (i = 0; i < info.lives.length; i++) {
            if (!sourceMembers[info.lives[i].record.member]) { throw new Error(T.brokenGroup); }
        }
        var members = [];
        for (i = 0; i < info.sources.length; i++) { members.push(info.sources[i].record.member); }
        members.sort();
        if (cacheRecord.members) {
            var expected = cacheRecord.members.split(",").sort();
            if (expected.join(",") !== members.join(",")) { throw new Error(T.brokenGroup); }
        }
        var start = Number(cacheRecord.start);
        var end = Number(cacheRecord.end);
        var epsilon = comp.frameDuration / 100;
        if (!isFinite(start) || !isFinite(end) || end <= start) { throw new Error(T.rangeChanged); }
        info.range = returning ? { start: start, end: end, duration: end - start } : alignRangeToFrames(comp, start, end);
        var cacheLayer = info.cache.layer;
        if (!returning && (Math.abs(info.range.start - start) > epsilon || Math.abs(info.range.end - end) > epsilon ||
            Math.abs(cacheLayer.startTime - start) > epsilon || Math.abs(cacheLayer.inPoint - start) > epsilon ||
            Math.abs(cacheLayer.outPoint - end) > epsilon)) { throw new Error(T.rangeChanged); }
        for (i = 0; i < info.sources.length; i++) {
            var segmentIn = Number(info.sources[i].record.segmentIn);
            var segmentOut = Number(info.sources[i].record.segmentOut);
            if (!isFinite(segmentIn) || !isFinite(segmentOut) || segmentOut <= segmentIn ||
                    Math.abs(info.sources[i].layer.inPoint - segmentIn) > epsilon ||
                    Math.abs(info.sources[i].layer.outPoint - segmentOut) > epsilon) {
                throw new Error(T.rangeChanged);
            }
        }
        info.editing = cacheRecord.editing === "1";
        for (i = 0; i < info.entries.length; i++) {
            var r = info.entries[i].record;
            if ((r.editing === "1") !== info.editing || Number(r.start) !== start || Number(r.end) !== end) {
                throw new Error(T.brokenGroup);
            }
            if (info.editing && (!/^[01]$/.test(r.eEnabled || "") || !/^[01]$/.test(r.eLocked || "") ||
                !/^[01]$/.test(r.eShy || ""))) { throw new Error(T.brokenGroup); }
        }
        var first = info.entries[0].layer.index;
        var last = info.entries[info.entries.length - 1].layer.index;
        for (i = first; i <= last; i++) {
            layer = comp.layer(i);
            if (!returning && !layerIndices[i] && !isAudioOnlyLayer(layer) && layer.enabled && layer.outPoint > start + epsilon &&
                layer.inPoint < end - epsilon && !isCameraOrLight(layer)) {
                throw new Error(T.brokenGroup);
            }
        }
        info.group = {
            id: id, sourceId: Number(cacheRecord.source), start: start, end: end,
            mode: cacheRecord.mode, scope: /^[012]$/.test(cacheRecord.scope || "") ? Number(cacheRecord.scope) : null,
            label: cacheLayer.label, members: members
        };
        return info;
    }

    function captureLayerSnapshots(entries) {
        var snapshots = [];
        for (var i = 0; i < entries.length; i++) {
            var layer = entries[i].layer;
            snapshots.push({
                layer: layer, enabled: layer.enabled, locked: layer.locked, shy: layer.shy,
                selected: layer.selected, comment: layer.comment, label: layer.label
            });
        }
        return snapshots;
    }

    function restoreLayerSnapshots(snapshots) {
        var errors = [];
        for (var i = 0; i < snapshots.length; i++) {
            var s = snapshots[i];
            try {
                s.layer.locked = false;
                s.layer.enabled = s.enabled;
                s.layer.shy = s.shy;
                s.layer.comment = s.comment;
                s.layer.label = s.label;
                s.layer.selected = s.selected;
                s.layer.locked = s.locked;
            } catch (error) { errors.push(error.message || String(error)); }
        }
        return errors;
    }

    function desiredSourceEnabled(entry, editing) {
        if (editing) { return entry.layer.enabled; }
        var record = entry.record;
        if (record.draftEnabled === "0" || record.draftEnabled === "1") { return record.draftEnabled === "1"; }
        return record.liveEnabled !== "0";
    }

    function sourceDesiredForInfo(info, entry) {
        return getCompositionMode(info.comp) === "modify" ? entry.layer.enabled :
            desiredSourceEnabled(entry, info.editing);
    }

    function clearEditChanges() {
        return { editing: null, eEnabled: null, eLocked: null, eShy: null };
    }

    function beginGroupEditing(info) {
        if (info.editing) { return false; }
        var snapshots = captureLayerSnapshots(info.entries);
        managementUndo(function () {
            try {
                for (var i = 0; i < info.entries.length; i++) {
                    var entry = info.entries[i];
                    var layer = entry.layer;
                    var s = snapshots[i];
                    layer.locked = false;
                    writeGroupMetadata(layer, info.id, {
                        editing: "1", eEnabled: s.enabled ? "1" : "0",
                        eLocked: s.locked ? "1" : "0", eShy: s.shy ? "1" : "0"
                    });
                    var isSource = entry.record.kind === "sourceRef";
                    layer.enabled = isSource ? desiredSourceEnabled(entry, false) : false;
                    if (isSource) { layer.shy = false; }
                    layer.selected = isSource;
                    layer.locked = !isSource;
                }
            } catch (error) {
                var recovery = restoreLayerSnapshots(snapshots);
                throw new Error((error.message || String(error)) +
                    (recovery.length ? "\n" + T.recoveryWarning + recovery.join("\n") : ""));
            }
        });
        return true;
    }

    function returnGroupToCache(info) {
        if (!info.editing) { throw new Error(T.returnNotEditing); }
        var snapshots = captureLayerSnapshots(info.entries);
        managementUndo(function () {
            try {
                for (var i = 0; i < info.entries.length; i++) {
                    var entry = info.entries[i];
                    var layer = entry.layer;
                    var changes = clearEditChanges();
                    if (entry.record.kind === "sourceRef") { changes.draftEnabled = layer.enabled ? "1" : "0"; }
                    if (entry.record.kind === "cache") { changes.stale = "1"; }
                    layer.locked = false;
                    writeGroupMetadata(layer, info.id, changes);
                    layer.enabled = entry.record.eEnabled === "1";
                    layer.shy = entry.record.eShy === "1";
                    layer.selected = entry.record.kind === "cache";
                    layer.locked = entry.record.eLocked === "1";
                }
            } catch (error) {
                var recovery = restoreLayerSnapshots(snapshots);
                throw new Error((error.message || String(error)) +
                    (recovery.length ? "\n" + T.recoveryWarning + recovery.join("\n") : ""));
            }
        });
    }

    function editSelectedGroup() {
        try {
            var comp = requireManagementComp();
            if (hasAnySolo(comp)) { throw new Error(T.soloApplyBlocked); }
            var info = describeEditableGroup(comp, selectedEditableGroupId(comp));
            var started = beginGroupEditing(info);
            setStatus((started ? T.editStarted : T.editingAlready) + "\n" + info.id);
        } catch (error) { if (state.bridgeMode) { throw error; } alert(error.message || String(error), SCRIPT_NAME); }
    }

    function returnSelectedGroupToCache() {
        try {
            var comp = requireManagementComp();
            var info = describeEditableGroup(comp, selectedEditableGroupId(comp), true);
            returnGroupToCache(info);
            setStatus(T.returnedCache + "\n" + info.id);
        } catch (error) { if (state.bridgeMode) { throw error; } alert(error.message || String(error), SCRIPT_NAME); }
    }

    function createLiveSegment(original, inPoint, outPoint, group, member, kind) {
        var segment = original.duplicate();
        try {
            segment.locked = false;
            segment.name = liveSegmentName(group, member, kind, original.name);
            segment.inPoint = inPoint;
            segment.outPoint = outPoint;
            segment.shy = false;
            try { segment.audioEnabled = false; } catch (ignoreSegmentAudio) {}
            removeInheritedMetadata(segment);
            tagManagedLayer(segment, group, member, kind);
        } catch (error) {
            try { segment.locked = false; segment.remove(); } catch (ignoreRemove) {}
            throw error;
        }
        return segment;
    }

    function createWorkingSegment(original, inPoint, outPoint, originalState) {
        var segment = original.duplicate();
        try {
            segment.locked = false;
            segment.name = originalState.name;
            segment.inPoint = inPoint;
            segment.outPoint = outPoint;
            segment.label = originalState.label;
            segment.shy = originalState.shy;
            segment.selected = false;
            removeInheritedMetadata(segment);
            segment.locked = originalState.locked;
        } catch (error) {
            try { segment.locked = false; segment.remove(); } catch (ignoreRemove) {}
            throw error;
        }
        return segment;
    }

    function makeUpdateRenderComp(info, projectFolder) {
        var renderComp = info.comp.duplicate();
        try {
            renderComp.name = uniqueItemName("__PR_RENDER__ " + info.comp.name);
            renderComp.parentFolder = projectFolder;
            var targets = {};
            var has3D = false;
            for (var i = 0; i < info.sources.length; i++) {
                var entry = info.sources[i];
                targets[entry.layer.index] = sourceDesiredForInfo(info, entry);
                try { if (entry.layer.threeDLayer) { has3D = true; } } catch (ignore3D) {}
            }
            for (i = 1; i <= renderComp.numLayers; i++) {
                var layer = renderComp.layer(i);
                if (isAudioOnlyLayer(layer)) { continue; }
                var enabled = targets.hasOwnProperty(i) ? targets[i] : (has3D && isCameraOrLight(layer) && layer.enabled);
                withUnlockedLayer(layer, function (item) {
                    item.enabled = !!enabled;
                    try { item.audioEnabled = false; } catch (ignoreAudio) {}
                });
            }
            return { comp: renderComp, temporary: true };
        } catch (error) {
            try { renderComp.remove(); } catch (ignoreRemove) {}
            throw error;
        }
    }

    function validateUpdatedFootage(info, footageItem) {
        var old = info.cache.layer.source;
        var epsilon = info.comp.frameDuration / 100;
        if (!isFinite(footageItem.duration) || footageItem.duration < info.range.duration - epsilon) {
            throw new Error(T.formatMismatch);
        }
        var attributes = ["width", "height", "pixelAspect", "frameRate"];
        for (var i = 0; i < attributes.length; i++) {
            var name = attributes[i];
            var previous = Number(old[name]);
            var next = Number(footageItem[name]);
            if (isFinite(previous) && isFinite(next) && Math.abs(previous - next) > 0.0001) {
                throw new Error(T.formatMismatch);
            }
        }
    }

    function commitGroupUpdate(info, footageItem) {
        validateUpdatedFootage(info, footageItem);
        var cache = info.cache.layer;
        var cacheState = {
            source: cache.source, name: cache.name, startTime: cache.startTime,
            inPoint: cache.inPoint, outPoint: cache.outPoint,
            blendingMode: cache.blendingMode, preserveTransparency: cache.preserveTransparency,
            audioEnabled: cache.audioEnabled
        };
        var snapshots = captureLayerSnapshots(info.entries);
        var desired = {};
        var swapped = false;
        for (var d = 0; d < info.sources.length; d++) {
            desired[info.sources[d].record.member] = sourceDesiredForInfo(info, info.sources[d]);
        }
        managementUndo(function () {
            try {
                cache.locked = false;
                swapped = true;
                cache.replaceSource(footageItem, false);
                cache.name = cacheState.name;
                cache.startTime = info.range.start;
                cache.inPoint = info.range.start;
                cache.outPoint = info.range.end;
                cache.audioEnabled = false;
                if (info.group.scope !== null && info.group.scope !== 0 && info.sources.length === 1) {
                    applySingleLayerBlendMode(cache, info.comp, [info.sources[0].layer.index],
                        info.group.scope, info.sources[0].layer);
                }
                for (var i = 0; i < info.entries.length; i++) {
                    var entry = info.entries[i];
                    var layer = entry.layer;
                    var changes = clearEditChanges();
                    layer.locked = false;
                    if (entry.record.kind === "sourceRef") {
                        changes.liveEnabled = desired[entry.record.member] ? "1" : "0";
                        changes.draftEnabled = null;
                        layer.enabled = desired[entry.record.member];
                        layer.shy = false;
                    } else if (entry.record.kind === "cache") {
                        changes.members = info.group.members.join(",");
                        changes.stale = null;
                        layer.enabled = false;
                        layer.shy = false;
                    }
                    writeGroupMetadata(layer, info.id, changes);
                    layer.selected = entry.record.kind === "sourceRef";
                    layer.locked = entry.record.kind === "cache";
                }
            } catch (error) {
                var recovery = [];
                if (swapped) {
                    try {
                        cache.locked = false;
                        cache.replaceSource(cacheState.source, false);
                        cache.name = cacheState.name;
                        cache.startTime = cacheState.startTime;
                        cache.inPoint = cacheState.inPoint;
                        cache.outPoint = cacheState.outPoint;
                        cache.blendingMode = cacheState.blendingMode;
                        cache.preserveTransparency = cacheState.preserveTransparency;
                        cache.audioEnabled = cacheState.audioEnabled;
                    } catch (restoreError) { recovery.push(restoreError.message || String(restoreError)); }
                }
                recovery = recovery.concat(restoreLayerSnapshots(snapshots));
                throw new Error((error.message || String(error)) +
                    (recovery.length ? "\n" + T.recoveryWarning + recovery.join("\n") : ""));
            }
        });
        return "";
    }

    function updateSelectedGroup() {
        try {
            var comp = requireManagementComp();
            if (hasAnySolo(comp)) { throw new Error(T.soloApplyBlocked); }
            if (getCompositionMode(comp) !== "modify") { throw new Error(T.updateNeedsModifyMode); }
            var id = selectedEditableGroupId(comp);
            var info = describeEditableGroup(comp, id);
            var templateName = getSelectedTemplateName();
            if (!templateName) { throw new Error(T.chooseTemplateFirst); }
            var outputPath = trimString(state.panel.folderText.text);
            var outputFolder = ensureFolder(outputPath ? new Folder(outputPath) : defaultOutputFolder());
            var indices = [];
            for (var i = 0; i < info.sources.length; i++) { indices.push(info.sources[i].layer.index); }
            if (!confirmRisks(comp, indices, info.group.scope === 0 ? 0 : 1, 0)) { return; }
            setStatus(T.statusRendering + "\n" + id);
            var job = renderFootageJob(comp, info.range, templateName, outputFolder, function (folder) {
                return makeUpdateRenderComp(info, folder);
            });
            job.footage.parentFolder = job.folder;
            info = describeEditableGroup(comp, id);
            var cleanup = commitGroupUpdate(info, job.footage);
            setCompositionMode(comp, "regular", id);
            state.sourceComp = comp;
            state.lastPreviewComp = comp;
            state.lastOutputItem = job.footage;
            state.lastGroupId = id;
            comp.openInViewer();
            setStatus(T.updatedCache + id + "\n" + job.outputFile.fsName + job.cleanupMessage + cleanup);
        } catch (error) {
            setStatus(T.updateFailed + "\n" + (error.message || String(error)));
            if (state.bridgeMode) { throw error; }
            alert(T.updateFailed + "\n\n" + (error.message || String(error)), SCRIPT_NAME);
        }
    }

    function splitTargetLayers(targetComp, targetIndices, range, group) {
        targetIndices = withoutAudioOnlyLayers(targetComp, targetIndices);
        var originals = [];
        var originalSnapshots = [];
        var created = [];
        var rolledBack = false;
        var i;
        for (i = 0; i < targetIndices.length; i++) {
            var originalLayer = targetComp.layer(targetIndices[i]);
            originals.push(originalLayer);
            var audioEnabled = null;
            try { audioEnabled = originalLayer.audioEnabled; } catch (ignoreSnapshotAudio) {}
            originalSnapshots.push({
                layer: originalLayer, name: originalLayer.name, comment: originalLayer.comment,
                inPoint: originalLayer.inPoint, outPoint: originalLayer.outPoint,
                enabled: originalLayer.enabled, audioEnabled: audioEnabled,
                label: originalLayer.label, shy: originalLayer.shy,
                selected: originalLayer.selected, locked: originalLayer.locked
            });
        }

        var initialMemberCount = group.members.length;
        function rollback() {
            if (rolledBack) { return []; }
            rolledBack = true;
            var errors = [];
            for (var removeIndex = created.length - 1; removeIndex >= 0; removeIndex--) {
                try { created[removeIndex].locked = false; created[removeIndex].remove(); }
                catch (removeError) { errors.push(removeError.message || String(removeError)); }
            }
            for (var restoreIndex = 0; restoreIndex < originalSnapshots.length; restoreIndex++) {
                var snapshot = originalSnapshots[restoreIndex];
                try {
                    snapshot.layer.locked = false;
                    snapshot.layer.name = snapshot.name;
                    snapshot.layer.comment = snapshot.comment;
                    snapshot.layer.inPoint = snapshot.inPoint;
                    snapshot.layer.outPoint = snapshot.outPoint;
                    snapshot.layer.enabled = snapshot.enabled;
                    if (snapshot.audioEnabled !== null) { snapshot.layer.audioEnabled = snapshot.audioEnabled; }
                    snapshot.layer.label = snapshot.label;
                    snapshot.layer.shy = snapshot.shy;
                    snapshot.layer.selected = snapshot.selected;
                    snapshot.layer.locked = snapshot.locked;
                } catch (restoreError) { errors.push(restoreError.message || String(restoreError)); }
            }
            group.members.length = initialMemberCount;
            return errors;
        }

        var topAnchor = originals[0];
        var epsilon = targetComp.frameDuration / 100;
        var anyOverlap = false;
        try {
            for (i = originals.length - 1; i >= 0; i--) {
                var original = originals[i];
                var wasEnabled = false;
                var originalIn = original.inPoint;
                var originalOut = original.outPoint;
                try { wasEnabled = original.enabled; } catch (ignoreReadEnabled) {}

                if (!wasEnabled || originalOut <= range.start + epsilon || originalIn >= range.end - epsilon) {
                    continue;
                }

                anyOverlap = true;
                var member = "L" + padNumber(i + 1, 2);
                group.members.push(member);
                var previousLabel = original.label;
                var previousShy = original.shy;
                var previousLocked = original.locked;
                var originalState = {
                    name: original.name, label: previousLabel, shy: previousShy, locked: previousLocked
                };
                var beforeSegment = null;
                var afterSegment = null;
                original.locked = false;

                if (originalIn < range.start - epsilon) {
                    beforeSegment = createWorkingSegment(
                        original, originalIn, Math.min(originalOut, range.start), originalState);
                    created.push(beforeSegment);
                }

                if (originalOut > range.end + epsilon) {
                    afterSegment = createWorkingSegment(
                        original, Math.max(originalIn, range.end), originalOut, originalState);
                    created.push(afterSegment);
                }

                var segmentIn = Math.max(originalIn, range.start);
                var segmentOut = Math.min(originalOut, range.end);
                original.inPoint = segmentIn;
                original.outPoint = segmentOut;
                original.enabled = false;
                original.shy = true;
                tagManagedLayer(original, group, member, "sourceRef",
                    ";previousLabel=" + previousLabel + ";previousShy=" + (previousShy ? "1" : "0") +
                    ";previousLocked=" + (previousLocked ? "1" : "0") +
                    ";segmentIn=" + segmentIn + ";segmentOut=" + segmentOut + ";liveEnabled=1");
                if (afterSegment) { original.moveBefore(afterSegment); }
                var familyTop = beforeSegment || original;
                if (familyTop.index < topAnchor.index) { topAnchor = familyTop; }
                original.locked = true;
            }
        } catch (error) {
            var recovery = rollback();
            throw new Error((error.message || String(error)) +
                (recovery.length ? "\n" + T.recoveryWarning + recovery.join("\n") : ""));
        }

        return {
            topAnchor: topAnchor,
            anyOverlap: anyOverlap,
            rollback: rollback
        };
    }

    function applySingleLayerBlendMode(cacheLayer, sourceComp, targetIndices, scopeIndex, singleSourceLayer) {
        if (scopeIndex === 0 || targetIndices.length !== 1) {
            return;
        }
        try {
            var sourceLayer = singleSourceLayer || sourceComp.layer(targetIndices[0]);
            cacheLayer.blendingMode = sourceLayer.blendingMode;
            try { cacheLayer.preserveTransparency = sourceLayer.preserveTransparency; } catch (ignorePreserveTransparency) {}
        } catch (ignoreCacheBlendMode) {}
    }

    function addCacheLayer(targetComp, footageItem, sourceComp, targetIndices, scopeIndex, range, topAnchor, group, singleSourceLayer) {
        var cacheLayer = targetComp.layers.add(footageItem);
        try {
            cacheLayer.name = "[" + group.id + " " + T.roleCache + " " +
                range.start.toFixed(3) + "s-" + range.end.toFixed(3) + "s] " + sourceComp.name;
            cacheLayer.startTime = range.start;
            cacheLayer.inPoint = range.start;
            cacheLayer.outPoint = Math.min(range.end, range.start + footageItem.duration);
            if (topAnchor) {
                cacheLayer.moveBefore(topAnchor);
            }
            try { cacheLayer.audioEnabled = false; } catch (ignoreAudio) {}
            applySingleLayerBlendMode(cacheLayer, sourceComp, targetIndices, scopeIndex, singleSourceLayer);
            tagManagedLayer(cacheLayer, group, "", "cache");
            cacheLayer.locked = true;
        } catch (error) {
            try { cacheLayer.locked = false; cacheLayer.remove(); } catch (ignoreRemoveCache) {}
            throw error;
        }
        return cacheLayer;
    }

    function buildPartialPreview(sourceComp, footageItem, targetIndices, scopeIndex, range, projectFolder) {
        targetIndices = withoutAudioOnlyLayers(sourceComp, targetIndices);
        if (!targetIndices.length) { throw new Error(T.noVisualTargets); }
        var group = createAssociationGroup(sourceComp, range, "partialPreview", scopeIndex);
        var preview = sourceComp.duplicate();
        try {
            preview.name = uniqueItemName(sourceComp.name + " [PR PARTIAL]");
            preview.parentFolder = projectFolder;

            var splitInfo = splitTargetLayers(preview, targetIndices, range, group);
            if (!splitInfo.anyOverlap) {
                throw new Error(T.noTargetOverlap);
            }
            addCacheLayer(
                preview,
                footageItem,
                sourceComp,
                targetIndices,
                scopeIndex,
                range,
                splitInfo.topAnchor,
                group
            );
            writeCompositionMode(preview, "regular");
        } catch (error) {
            var recovery = [];
            try { preview.remove(); } catch (removeError) { recovery.push(removeError.message || String(removeError)); }
            throw new Error((error.message || String(error)) +
                (recovery.length ? "\n" + T.recoveryWarning + recovery.join("\n") : ""));
        }
        state.lastGroupId = group.id;
        return preview;
    }

    function applyCacheToSourceComp(sourceComp, footageItem, targetIndices, scopeIndex, range) {
        targetIndices = withoutAudioOnlyLayers(sourceComp, targetIndices);
        if (!targetIndices.length) { throw new Error(T.noVisualTargets); }
        var group = createAssociationGroup(sourceComp, range, "applied", scopeIndex);
        var singleSourceLayer = targetIndices.length === 1 ? sourceComp.layer(targetIndices[0]) : null;
        var previousComment = sourceComp.comment;
        var splitInfo = null;
        var cacheLayer = null;
        try {
            splitInfo = splitTargetLayers(sourceComp, targetIndices, range, group);
            if (!splitInfo.anyOverlap) {
                throw new Error(T.noTargetOverlap);
            }
            cacheLayer = addCacheLayer(
                sourceComp,
                footageItem,
                sourceComp,
                targetIndices,
                scopeIndex,
                range,
                splitInfo.topAnchor,
                group,
                singleSourceLayer
            );
            writeCompositionMode(sourceComp, "regular");
        } catch (error) {
            var recovery = [];
            if (cacheLayer) {
                try { cacheLayer.locked = false; cacheLayer.remove(); }
                catch (removeError) { recovery.push(removeError.message || String(removeError)); }
            }
            if (splitInfo && splitInfo.rollback) { recovery = recovery.concat(splitInfo.rollback()); }
            try { sourceComp.comment = previousComment; }
            catch (commentError) { recovery.push(commentError.message || String(commentError)); }
            throw new Error((error.message || String(error)) +
                (recovery.length ? "\n" + T.recoveryWarning + recovery.join("\n") : ""));
        }
        state.lastGroupId = group.id;
        return sourceComp;
    }

    function buildPreviewComp(sourceComp, footageItem, targetIndices, scopeIndex, range, projectFolder) {
        if (scopeIndex === 0) {
            return buildFullCompPreview(sourceComp, footageItem, range, projectFolder);
        }
        return buildPartialPreview(sourceComp, footageItem, targetIndices, scopeIndex, range, projectFolder);
    }

    function suspendOtherQueueItems(ourItem) {
        var snapshots = [];
        for (var i = 1; i <= app.project.renderQueue.numItems; i++) {
            var item = app.project.renderQueue.item(i);
            if (item !== ourItem) {
                var wasQueued = false;
                try { wasQueued = item.render; } catch (ignoreRead) {}
                snapshots.push({ item: item, render: wasQueued });
                if (wasQueued) {
                    try { item.render = false; } catch (ignoreDisable) {}
                }
            }
        }
        return snapshots;
    }

    function restoreQueueItems(snapshots) {
        for (var i = 0; i < snapshots.length; i++) {
            if (snapshots[i].render) {
                try { snapshots[i].item.render = true; } catch (ignoreRestore) {}
            }
        }
    }

    function cleanupRenderArtifacts(rqItem, renderInfo) {
        var errors = [];
        var temporaryCompId = -1;
        var outputFileUri = "";
        if (renderInfo && renderInfo.temporary && renderInfo.comp) {
            try { temporaryCompId = renderInfo.comp.id; } catch (ignoreTempId) {}
        }
        if (renderInfo && renderInfo.outputFileUri) {
            outputFileUri = renderInfo.outputFileUri;
        }

        for (var i = app.project.renderQueue.numItems; i >= 1; i--) {
            var queueItem = app.project.renderQueue.item(i);
            var shouldRemove = false;
            try { shouldRemove = queueItem === rqItem; } catch (ignoreQueueIdentity) {}
            if (!shouldRemove && temporaryCompId >= 0) {
                try { shouldRemove = queueItem.comp.id === temporaryCompId; } catch (ignoreQueueCompId) {}
            }
            if (!shouldRemove && outputFileUri) {
                try {
                    var queueFile = queueItem.outputModule(1).file;
                    shouldRemove = queueFile && queueFile.absoluteURI === outputFileUri;
                } catch (ignoreQueueFile) {}
            }
            if (shouldRemove) {
                try { queueItem.remove(); } catch (removeQueueError) {
                    errors.push(removeQueueError.message || String(removeQueueError));
                }
            }
        }

        if (temporaryCompId >= 0) {
            for (i = app.project.numItems; i >= 1; i--) {
                var projectItem = app.project.item(i);
                var projectItemId = -1;
                try { projectItemId = projectItem.id; } catch (ignoreProjectItemId) {}
                if (projectItemId === temporaryCompId) {
                    try { projectItem.remove(); } catch (removeCompError) {
                        errors.push(removeCompError.message || String(removeCompError));
                    }
                    break;
                }
            }
        }

        if (errors.length) {
            throw new Error(errors.join("\n"));
        }
    }

    function setStatus(message) {
        state.lastStatus = String(message || "");
        if (state.panel && state.panel.statusText) {
            state.panel.statusText.text = message;
            if (state.panel.layout && state.panel.layout.layout) { state.panel.layout.layout(true); }
            try { state.panel.update(); } catch (ignoreUpdate) {}
        }
    }

    function getSelectedTemplateName() {
        var dropdown = state.panel.templateDropdown;
        return dropdown.selection ? dropdown.selection.text : "";
    }

    function renderFootageJob(sourceComp, range, templateName, outputFolder, makeComp) {
        var renderInfo = null;
        var rqItem = null;
        var snapshots = [];
        var undoOpen = false;
        var folder;
        var outputFile;
        var footageItem;
        try {
            app.beginUndoGroup(SCRIPT_NAME + " - Prepare");
            undoOpen = true;
            folder = ensureProjectFolder();
            renderInfo = makeComp(folder);
            rqItem = app.project.renderQueue.items.add(renderInfo.comp);
            rqItem.timeSpanStart = range.start;
            rqItem.timeSpanDuration = range.duration;
            var outputModule = rqItem.outputModule(1);
            outputModule.applyTemplate(resolveOutputTemplate(outputModule.templates, templateName));
            outputFile = createOutputFile(outputFolder, sourceComp, range, outputModule);
            outputModule.file = outputFile;
            renderInfo.outputFileUri = outputFile.absoluteURI;
            outputModule.postRenderAction = PostRenderAction.IMPORT;
            var previousIds = snapshotProjectItemIds();
            snapshots = suspendOtherQueueItems(rqItem);
            app.endUndoGroup();
            undoOpen = false;
            app.project.renderQueue.render();
            if (rqItem.status !== RQItemStatus.DONE) { throw new Error(T.renderFailed); }
            footageItem = findNewFootageItem(previousIds);
            if (!footageItem) { throw new Error(T.importFailed + "\n" + outputFile.fsName); }
        } catch (error) {
            if (undoOpen) {
                try { app.endUndoGroup(); } catch (ignoreEnd) {}
            }
            restoreQueueItems(snapshots);
            try { cleanupRenderArtifacts(rqItem, renderInfo); } catch (ignoreCleanup) {}
            throw error;
        }
        restoreQueueItems(snapshots);
        var cleanupMessage = "";
        try { cleanupRenderArtifacts(rqItem, renderInfo); }
        catch (error) {
            cleanupMessage = "\n" + T.cleanupWarning + "\n" + (error.message || String(error));
        }
        return { footage: footageItem, folder: folder, outputFile: outputFile, cleanupMessage: cleanupMessage };
    }

    function renderPrecomp() {
        if (!app.project) {
            if (state.bridgeMode) { throw new Error(T.noComp); }
            alert(T.noComp, SCRIPT_NAME); return;
        }
        if (app.project.renderQueue.rendering) {
            if (state.bridgeMode) { throw new Error(T.projectRendering); }
            alert(T.projectRendering, SCRIPT_NAME); return;
        }

        var sourceComp = getActiveComp();
        if (!sourceComp) {
            if (state.bridgeMode) { throw new Error(T.noComp); }
            alert(T.noComp, SCRIPT_NAME); return;
        }
        if (editingGroupIds(sourceComp).length) {
            if (state.bridgeMode) { throw new Error(T.anotherEditing); }
            alert(T.anotherEditing, SCRIPT_NAME); return;
        }
        if (modeGroupCount(compositionModeGroups(sourceComp)) && getCompositionMode(sourceComp) === "modify") {
            if (state.bridgeMode) { throw new Error(T.newRenderNeedsRegular); }
            alert(T.newRenderNeedsRegular, SCRIPT_NAME); return;
        }

        var scopeIndex = state.panel.scopeDropdown.selection.index;
        var rangeIndex = state.panel.rangeDropdown.selection.index;
        var resultModeIndex = state.panel.resultModeDropdown.selection.index;
        var templateName = getSelectedTemplateName();
        if (!templateName) {
            if (state.bridgeMode) { throw new Error(T.chooseTemplateFirst); }
            alert(T.chooseTemplateFirst, SCRIPT_NAME); return;
        }

        var outputFolderPath = trimString(state.panel.folderText.text);
        var outputFolder = outputFolderPath ? new Folder(outputFolderPath) : defaultOutputFolder();
        var targetIndices;
        var range;

        try {
            targetIndices = getTargetIndices(sourceComp, scopeIndex);
            if (!targetIndices.length) { throw new Error(T.noVisualTargets); }
            range = getRange(sourceComp, rangeIndex);
            if (targetHasManagedOverlap(sourceComp, targetIndices, range)) {
                throw new Error(T.existingBlockOverlap);
            }
            if (!targetHasOverlap(sourceComp, targetIndices, range)) {
                throw new Error(T.noTargetOverlap);
            }
            ensureFolder(outputFolder);
        } catch (validationError) {
            if (state.bridgeMode) { throw validationError; }
            alert(validationError.message || String(validationError), SCRIPT_NAME); return;
        }

        if (!confirmRisks(sourceComp, targetIndices, scopeIndex, resultModeIndex)) {
            return;
        }
        if (resultModeIndex === 0 && hasAppliedResultLayers(sourceComp) && !state.risksConfirmed && !confirm(T.repeatApplyWarning)) {
            return;
        }

        state.sourceComp = sourceComp;
        setStatus(T.statusRendering);

        var job;
        try {
            job = renderFootageJob(sourceComp, range, templateName, outputFolder, function (folder) {
                return makeRenderComp(sourceComp, targetIndices, scopeIndex, folder);
            });
        } catch (renderError) {
            setStatus(T.unknownError + (renderError.message || String(renderError)));
            if (state.bridgeMode) { throw renderError; }
            alert(T.unknownError + "\n" + (renderError.message || String(renderError)), SCRIPT_NAME); return;
        }
        var footageItem = job.footage;
        var projectFolder = job.folder;

        var resultUndoOpen = false;
        try {
            app.beginUndoGroup(SCRIPT_NAME + " - Build Result");
            resultUndoOpen = true;
            footageItem.parentFolder = projectFolder;
            var resultComp;
            if (resultModeIndex === 0) {
                resultComp = applyCacheToSourceComp(
                    sourceComp,
                    footageItem,
                    targetIndices,
                    scopeIndex,
                    range
                );
            } else {
                resultComp = buildPreviewComp(
                    sourceComp,
                    footageItem,
                    targetIndices,
                    scopeIndex,
                    range,
                    projectFolder
                );
            }
            state.lastPreviewComp = resultComp;
            state.lastOutputItem = footageItem;
            app.endUndoGroup();
            resultUndoOpen = false;

            resultComp.openInViewer();
            var donePrefix = resultModeIndex === 0 ? T.statusDoneApplied : T.statusDone;
            setStatus(donePrefix + " " + resultComp.name + " [" + state.lastGroupId + "]\n" +
                job.outputFile.fsName + job.cleanupMessage);
            return { comp: resultComp.name, group: state.lastGroupId, file: job.outputFile.fsName };
        } catch (finalizeError) {
            if (resultUndoOpen) {
                try { app.endUndoGroup(); } catch (ignoreFinalizeEnd) {}
            }
            setStatus(T.unknownError + (finalizeError.message || String(finalizeError)));
            if (state.bridgeMode) { throw finalizeError; }
            alert(T.unknownError + "\n" + (finalizeError.message || String(finalizeError)), SCRIPT_NAME);
        }
    }

    function refreshTemplates() {
        var comp = getActiveComp();
        if (!comp) {
            setStatus(T.noComp);
            return;
        }
        if (app.project.renderQueue.rendering) {
            setStatus(T.projectRendering);
            return;
        }

        var previousSelection = getSelectedTemplateName();
        var dropdown = state.panel.templateDropdown;
        while (dropdown.items.length) {
            dropdown.remove(dropdown.items[0]);
        }
        state.templateNames = [];

        var rqItem = null;
        try {
            rqItem = app.project.renderQueue.items.add(comp);
            var templates = rqItem.outputModule(1).templates;
            for (var i = 0; i < templates.length; i++) {
                state.templateNames.push(templates[i]);
                dropdown.add("item", templates[i]);
            }
            rqItem.remove();
            rqItem = null;

            var selectedIndex = 0;
            if (previousSelection) {
                for (i = 0; i < state.templateNames.length; i++) {
                    if (state.templateNames[i] === previousSelection) {
                        selectedIndex = i;
                        break;
                    }
                }
            } else {
                for (i = 0; i < state.templateNames.length; i++) {
                    if (/alpha/i.test(state.templateNames[i])) {
                        selectedIndex = i;
                        break;
                    }
                }
            }

            if (dropdown.items.length) {
                dropdown.selection = selectedIndex;
                setStatus(T.statusReady);
            } else {
                setStatus(T.noTemplate);
            }
        } catch (templateError) {
            if (rqItem) {
                try { rqItem.remove(); } catch (ignoreRemove) {}
            }
            setStatus(T.unknownError + (templateError.message || String(templateError)));
        }
    }

    function chooseOutputFolder() {
        var initialPath = trimString(state.panel.folderText.text);
        var initialFolder = initialPath ? new Folder(initialPath) : defaultOutputFolder();
        try {
            if (initialFolder.exists) {
                Folder.current = initialFolder;
            }
        } catch (ignoreCurrentFolder) {}
        var chosen = Folder.selectDialog(T.chooseFolder);
        if (chosen) {
            state.panel.folderText.text = chosen.fsName;
        }
    }

    function openComp(comp, missingMessage) {
        if (comp && comp instanceof CompItem) {
            comp.openInViewer();
        } else {
            alert(missingMessage || T.noComp, SCRIPT_NAME);
        }
    }

    function buildUI(thisObj) {
        var panel = thisObj instanceof Panel ? thisObj : new Window("palette", T.title, undefined, { resizeable: true });
        panel.orientation = "column";
        panel.alignChildren = ["fill", "top"];
        panel.spacing = 8;
        panel.margins = 12;

        var sourceGroup = panel.add("group");
        sourceGroup.orientation = "row";
        sourceGroup.alignChildren = ["left", "center"];
        sourceGroup.add("statictext", undefined, T.source + ":");
        var sourceName = sourceGroup.add("statictext", undefined, "-");
        sourceName.alignment = ["fill", "center"];
        sourceGroup.add("statictext", undefined, "v" + SCRIPT_VERSION);

        var scopeGroup = panel.add("group");
        scopeGroup.orientation = "row";
        scopeGroup.alignChildren = ["left", "center"];
        scopeGroup.add("statictext", undefined, T.scope + ":");
        var scopeDropdown = scopeGroup.add("dropdownlist", undefined, T.scopes);
        scopeDropdown.selection = 0;
        scopeDropdown.helpTip = T.audioPolicyHint;
        scopeDropdown.alignment = ["fill", "center"];

        var rangeGroup = panel.add("group");
        rangeGroup.orientation = "row";
        rangeGroup.alignChildren = ["left", "center"];
        rangeGroup.add("statictext", undefined, T.range + ":");
        var rangeDropdown = rangeGroup.add("dropdownlist", undefined, T.ranges);
        rangeDropdown.selection = 0;
        rangeDropdown.alignment = ["fill", "center"];
        var rangeMarkerButton = rangeGroup.add("button", undefined, T.createRangeMarker);

        var resultModeGroup = panel.add("group");
        resultModeGroup.orientation = "row";
        resultModeGroup.alignChildren = ["left", "center"];
        resultModeGroup.add("statictext", undefined, T.resultMode + ":");
        var resultModeDropdown = resultModeGroup.add("dropdownlist", undefined, T.resultModes);
        resultModeDropdown.selection = 0;
        resultModeDropdown.alignment = ["fill", "center"];

        var applyHintText = panel.add("statictext", undefined, T.applyHint, { multiline: true });
        applyHintText.preferredSize = [420, 46];

        var templateGroup = panel.add("group");
        templateGroup.orientation = "row";
        templateGroup.alignChildren = ["left", "center"];
        templateGroup.add("statictext", undefined, T.template + ":");
        var templateDropdown = templateGroup.add("dropdownlist", undefined, []);
        templateDropdown.alignment = ["fill", "center"];
        templateDropdown.preferredSize.width = 210;
        var refreshButton = templateGroup.add("button", undefined, T.refreshTemplates);

        var folderGroup = panel.add("group");
        folderGroup.orientation = "row";
        folderGroup.alignChildren = ["left", "center"];
        folderGroup.add("statictext", undefined, T.outputFolder + ":");
        var folderText = folderGroup.add("edittext", undefined, defaultOutputFolder().fsName);
        folderText.alignment = ["fill", "center"];
        folderText.preferredSize.width = 250;
        var browseButton = folderGroup.add("button", undefined, T.browse);

        var renderButton = panel.add("button", undefined, T.render);
        renderButton.alignment = ["fill", "top"];
        renderButton.preferredSize.height = 34;

        var navGroup = panel.add("group");
        navGroup.orientation = "row";
        navGroup.alignChildren = ["fill", "center"];
        var sourceButton = navGroup.add("button", undefined, T.openSource);
        var previewButton = navGroup.add("button", undefined, T.openPreview);

        var managementPanel = panel.add("panel", undefined, T.management);
        managementPanel.orientation = "column";
        managementPanel.alignChildren = ["fill", "top"];
        var associationButtons = managementPanel.add("group");
        associationButtons.alignChildren = ["fill", "center"];
        var relatedButton = associationButtons.add("button", undefined, T.selectRelated);
        var locateSourceButton = associationButtons.add("button", undefined, T.locateSource);
        relatedButton.helpTip = T.managementHint;
        var modeButtons = managementPanel.add("group");
        modeButtons.alignChildren = ["fill", "center"];
        modeButtons.add("statictext", undefined, T.currentMode + ":");
        var currentModeText = modeButtons.add("statictext", undefined, "-");
        currentModeText.preferredSize.width = 72;
        var regularModeButton = modeButtons.add("button", undefined, T.regularMode);
        var modifyModeButton = modeButtons.add("button", undefined, T.modifyMode);
        regularModeButton.helpTip = T.regularModeHint;
        modifyModeButton.helpTip = T.modifyModeHint;
        var updateCacheButton = managementPanel.add("button", undefined, T.updateCache);
        updateCacheButton.alignment = ["fill", "center"];
        updateCacheButton.helpTip = T.editHint;
        var editHintText = managementPanel.add("statictext", undefined, T.editHint, { multiline: true });
        editHintText.preferredSize = [420, 46];

        var statusPanel = panel.add("panel", undefined, T.status);
        statusPanel.orientation = "column";
        statusPanel.alignChildren = ["fill", "fill"];
        var statusText = statusPanel.add("statictext", undefined, T.statusReady, { multiline: true });
        statusText.preferredSize = [420, 58];

        panel.scopeDropdown = scopeDropdown;
        panel.rangeDropdown = rangeDropdown;
        panel.resultModeDropdown = resultModeDropdown;
        panel.templateDropdown = templateDropdown;
        panel.folderText = folderText;
        panel.statusText = statusText;
        panel.sourceName = sourceName;

        function updateSourceName() {
            var comp = getActiveComp();
            sourceName.text = comp ? comp.name : "-";
            currentModeText.text = comp && modeGroupCount(compositionModeGroups(comp)) ?
                (getCompositionMode(comp) === "modify" ? T.modifyMode : T.regularMode) : "-";
        }

        refreshButton.onClick = function () {
            updateSourceName();
            refreshTemplates();
        };
        browseButton.onClick = chooseOutputFolder;
        rangeMarkerButton.onClick = createOrRevealRangeMarker;
        resultModeDropdown.onChange = function () {
            applyHintText.visible = resultModeDropdown.selection && resultModeDropdown.selection.index === 0;
            panel.layout.layout(true);
        };
        renderButton.onClick = function () {
            updateSourceName();
            renderPrecomp();
        };
        sourceButton.onClick = function () {
            openComp(state.sourceComp || getActiveComp(), T.noComp);
        };
        previewButton.onClick = function () {
            openComp(state.lastPreviewComp, T.renderFailed);
        };
        relatedButton.onClick = function () { selectAssociatedLayers(false); };
        locateSourceButton.onClick = function () { selectAssociatedLayers(true); };
        regularModeButton.onClick = function () { switchCompositionMode("regular"); updateSourceName(); };
        modifyModeButton.onClick = function () { switchCompositionMode("modify"); updateSourceName(); };
        updateCacheButton.onClick = function () { updateSelectedGroup(); updateSourceName(); };

        panel.onShow = function () {
            updateSourceName();
            refreshTemplates();
        };
        panel.onResizing = panel.onResize = function () {
            this.layout.resize();
        };

        state.panel = panel;
        updateSourceName();
        refreshTemplates();
        return panel;
    }

    function clampIndex(value, maximum) {
        var index = Math.floor(Number(value));
        if (!isFinite(index) || index < 0) { index = 0; }
        return Math.min(maximum, index);
    }

    function configureBridge(data) {
        data = data || {};
        var templateName = String(data.templateName || "");
        state.panel = {
            scopeDropdown: { selection: { index: clampIndex(data.scope, 2) } },
            rangeDropdown: { selection: { index: clampIndex(data.range, 3) } },
            resultModeDropdown: { selection: { index: clampIndex(data.resultMode, 1) } },
            templateDropdown: { selection: templateName ? { text: templateName } : null },
            folderText: { text: trimString(data.outputFolder) || defaultOutputFolder().fsName },
            statusText: { text: "" },
            layout: { layout: function () {} },
            update: function () {}
        };
        state.lastStatus = "";
    }

    function resolveOutputTemplate(templates, requested) {
        var matches = [], i, name;
        requested = String(requested || "");
        for (i = 0; i < templates.length; i++) {
            name = String(templates[i]);
            if (name === requested) { return name; }
            if (trimString(name) === trimString(requested)) { matches.push(name); }
        }
        if (matches.length === 1) { return matches[0]; }
        throw new Error("输出模块模板已变化或名称无法唯一匹配：" + requested + "。请点击预渲染页的“读取 / 刷新”，重新选择模板后再试。");
    }

    function outputTemplates(comp) {
        var result = [], rqItem = null, previousViewer = null, i;
        if (!comp) { return result; }
        if (app.project.renderQueue.rendering) { throw new Error(T.projectRendering); }
        try { previousViewer = app.activeViewer; } catch (ignoredViewer) { previousViewer = null; }
        try {
            rqItem = app.project.renderQueue.items.add(comp);
            var templates = rqItem.outputModule(1).templates;
            for (i = 0; i < templates.length; i++) { result.push(String(templates[i])); }
        } finally {
            if (rqItem) { try { rqItem.remove(); } catch (ignored) {} }
            try {
                if (previousViewer && previousViewer.setActive) { previousViewer.setActive(); }
                else { comp.openInViewer(); }
            } catch (ignoredRestore) { try { comp.openInViewer(); } catch (ignoredFallback) {} }
        }
        state.templateNames = result.slice(0);
        return result;
    }

    function bridgeStatus() {
        var comp = getActiveComp(), marker = null, groups = {}, groupCount = 0, templates = state.templateNames.slice(0);
        if (comp) {
            try { marker = findRangeMarker(comp); } catch (ignored) { marker = null; }
            groups = compositionModeGroups(comp); groupCount = modeGroupCount(groups);
        }
        return {
            comp: comp ? comp.name : "", selectedCount: comp ? comp.selectedLayers.length : 0,
            rendering: !!(app.project && app.project.renderQueue.rendering), templates: templates,
            outputFolder: defaultOutputFolder().fsName,
            mode: comp && groupCount ? getCompositionMode(comp) : "none", groupCount: groupCount,
            rangeMarker: marker ? { time: marker.time, duration: marker.value.duration, count: marker.count } : null,
            lastGroupId: state.lastGroupId, hasPreview: !!(state.lastPreviewComp && state.lastPreviewComp instanceof CompItem), lastStatus: state.lastStatus
        };
    }

    function bridgeTemplates() {
        var comp = getActiveComp();
        if (!comp) { throw new Error(T.noComp); }
        outputTemplates(comp);
        return bridgeStatus();
    }

    function bridgePreflight(data) {
        configureBridge(data);
        var comp = requireManagementComp(), scopeIndex = state.panel.scopeDropdown.selection.index;
        var rangeIndex = state.panel.rangeDropdown.selection.index, resultModeIndex = state.panel.resultModeDropdown.selection.index;
        var targetIndices = getTargetIndices(comp, scopeIndex), range, warnings = [], risks;
        if (!targetIndices.length) { throw new Error(T.noVisualTargets); }
        range = getRange(comp, rangeIndex);
        if (targetHasManagedOverlap(comp, targetIndices, range)) { throw new Error(T.existingBlockOverlap); }
        if (!targetHasOverlap(comp, targetIndices, range)) { throw new Error(T.noTargetOverlap); }
        if (hasAnySolo(comp) && (resultModeIndex === 0 || scopeIndex !== 0)) { throw new Error(resultModeIndex === 0 ? T.soloApplyBlocked : T.soloBlocked); }
        if (scopeIndex !== 0) { warnings.push(T.alphaWarning); }
        risks = collectRisks(comp, targetIndices, scopeIndex);
        for (var i = 0; i < risks.length; i++) { warnings.push(risks[i]); }
        if (resultModeIndex === 0 && hasAppliedResultLayers(comp)) { warnings.push(T.repeatApplyWarning); }
        return { warnings: warnings, needsConfirm: warnings.length > 0, start: range.start, duration: range.duration, targetCount: targetIndices.length };
    }

    function bridgeChooseFolder(data) {
        configureBridge(data);
        var initial = Folder(state.panel.folderText.text);
        try { if (initial.exists) { Folder.current = initial; } } catch (ignored) {}
        var chosen = Folder.selectDialog(T.chooseFolder);
        return { cancelled: !chosen, folder: chosen ? chosen.fsName : state.panel.folderText.text };
    }

    function bridgeRun(action, data) {
        data = data || {};
        if (action === "prerenderStatus") { return { ok: true, message: T.statusReady, data: bridgeStatus() }; }
        if (action === "prerenderTemplates") { return { ok: true, message: "已读取 AE 输出模块模板。", data: bridgeTemplates() }; }
        if (action === "prerenderPreflight") { return { ok: true, message: "预渲染检查完成。", data: bridgePreflight(data) }; }
        if (action === "prerenderChooseFolder") { return { ok: true, message: "已选择预渲染输出目录。", data: bridgeChooseFolder(data) }; }
        configureBridge(data);
        state.risksConfirmed = data.confirmed === true;
        try {
            if (action === "prerenderCreateRange") {
                createOrRevealRangeMarker();
            } else if (action === "prerenderRender") {
                if (!state.risksConfirmed) { throw new Error("请先确认预渲染范围和风险提示。"); }
                var rendered = renderPrecomp();
                return { ok: true, message: state.lastStatus || T.statusDone, data: rendered || {} };
            } else if (action === "prerenderMode") {
                if (data.mode !== "regular" && data.mode !== "modify") { throw new Error("预渲染模式无效。"); }
                switchCompositionMode(data.mode);
            } else if (action === "prerenderSelect") {
                selectAssociatedLayers(data.sourcesOnly === true);
            } else if (action === "prerenderUpdate") {
                if (!state.risksConfirmed) { throw new Error("请先确认更新预渲染缓存。"); }
                updateSelectedGroup();
            } else if (action === "prerenderReturnCache") {
                returnSelectedGroupToCache();
            } else if (action === "prerenderOpen") {
                var target = data.target === "preview" ? state.lastPreviewComp : (state.sourceComp || getActiveComp());
                if (!target || !(target instanceof CompItem)) { throw new Error(data.target === "preview" ? T.renderFailed : T.noComp); }
                target.openInViewer(); setStatus("已打开合成：" + target.name);
            } else { throw new Error("未知预渲染操作。"); }
            return { ok: true, message: state.lastStatus || T.statusReady, data: bridgeStatus() };
        } finally { state.risksConfirmed = false; }
    }

    function handles(action) { return /^prerender(?:Status|Templates|Preflight|ChooseFolder|CreateRange|Render|Mode|Select|Update|ReturnCache|Open)$/.test(String(action || "")); }
    return { handles: handles, run: bridgeRun, version: SCRIPT_VERSION };
}());
true;
