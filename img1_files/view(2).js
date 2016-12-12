define(["jquery","underscore","backbone","common/utils/log","plugin-dependencies","plugin-components/context-menu","plugin-components/data-store","common/notifications","./comment-view","./version-view","./version-cluster-view","text!./view.html","text!./comment-block.html"],function(e,t,i,s,a,r,n,o,l,m,c,d,h){"use strict";var v=a.utils.template.createTemplate(d),u=a.utils.template.createTemplate(h),f=a.log("ccweb.files.activity"),p=function(e){var i=a.user.get("userId"),s=t.find(e,function(e){return e.userId===i});return"viewer"!==s.role||!1};return i.View.extend({className:"control-container",events:{"keypress input":"keypress","keyup textarea":"keypress","keypress textarea":"handleMaxLength","focus .comment-textarea":"toggleComments","click .btn-cancel":"toggleComments","click .btn-submit":"handleSubmit"},initialize:function(){t.bindAll(this,"render","handleMenuShow","handleSelectionChange","toggleComments","handleSubmit","refreshActivityStream","renderActivityStream","toggleVersionPreview","startNotifications","stopNotifications"),this.activityFilter="filterall",this.currentVersionSelected=null},render:function(){var e=this;return this.model.get("_parentMountTarget")||this.model.get("parent_id")&&this.model.get("_collaboratorCount")>1?n.getCollaboration(this.model.get("parent_id")||this.model.get("_parentMountTarget")).then(function(t){e.model.isWritable=p(t.collaborators),e.populate()}):(e.model.isWritable=!0,this.populate()),this},populate:function(){this.dateHeader=null;var e,t,i,s=this.model.isWritable,n=this.displayRevisions,o=n&&!s,l=s&&!n,m=s&&n;return m?(e=a.translate("All Activity"),t="<em></em>",i=u({translate:a.translate})):l?(e=a.translate("Comments"),t="",i=u({translate:a.translate})):o?(e=a.translate("All Activity"),t="<em></em>",i=""):(e="",t="",i='<p class="no-activity">'+a.translate("There is currently no activity.")+"</p>"),this.$el.html(v({revisionsTitle:e,revisionsArrow:t,commentHTML:i})),o||l||m||this.$el.find(".filter").remove(),(m||o)&&(this.contextMenu=r({name:"file-activity-filter",$toggle:this.$("h4.filter"),$after:this.$("h4.filter"),items:["filterall","filtercomments","filterversions"]}),this.$(".filter").addClass("menu-active"),this.contextMenu.on("show",this.handleMenuShow),this.contextMenu.on("selection",this.handleSelectionChange)),this.isLoggedIn&&s&&(this.$(".comment-form").addClass("signed-in-comment-form"),this.formInputEls=this.$(".comment-form :input")),(o||l||m)&&(a.utils.isPlaceholder()||this.$(".comment-form label b").addClass("show"),this.model.on("change:_version",this.toggleVersionPreview),this.startNotifications(),this.refreshActivityStream(),this.delegateEvents(this.events)),this},remove:function(){this.model.off("change:_version",this.toggleVersionPreview),this.model.get("_version")!==this.model.get("_versionHead")&&this.model.set("_version",this.model.get("_versionHead")),this.stopNotifications(),this.clearTimerAgo()},handleMenuShow:function(t){var i=this;t.find("a").removeClass("active"),t.find("a").each(function(){e(this).attr("data")===i.activityFilter&&e(this).addClass("active")})},handleSelectionChange:function(e){this.activityFilter=e,this.dateHeader=null,this.$el.attr("class","control-container"),this.$(".add-comment label").removeClass("error");var t;switch(e){case"filterversions":s("cca",{desc:"Activity",activity:"Versions",assetid:this.model.get("id")}),t=a.translate("Versions");break;case"filtercomments":s("cca",{desc:"Activity",activity:"Comments",assetid:this.model.get("id")}),t=a.translate("Comments");break;default:t=a.translate("All Activity"),s("cca",{desc:"Activity",activity:"All",assetid:this.model.get("id")})}this.$(".filter b").text(t),this.$el.addClass(e),this.$(".add-comment").removeClass("comments-open"),this.refreshActivityStream()},toggleComments:function(t){"focusin"!=t.type?(this.$(".add-comment").toggleClass("comments-open"),e(".share-page .footer").toggleClass("comments-open")):(this.$(".add-comment").addClass("comments-open"),e(".share-page .footer").addClass("comments-open")),e(t.target).hasClass("btn-cancel")&&(this.$("label").removeClass("error"),this.$("input, textarea").val(""),this.$(".server-error").remove(),this.$(".char-count em").text("0"),f("cancel-add-comment"))},toggleVersionPreview:function(e){e.get("_version")===e.get("_versionHead")?(this.startNotifications(),this.$(".activity-stream li.selected").removeClass("selected"),this.$(".activity-stream li.version").first().addClass("current selected"),f("current-version")):(this.stopNotifications(),f("preview-version"))},handleMaxLength:function(e){if(a.utils.isIE9OrEarlier()){var t=this.$(".comment-textarea").attr("maxlength"),i=this.$(".comment-textarea").val();i.length==t&&e.preventDefault()}},keypress:function(t){var i=e(t.target).closest("label"),s=i.find(".char-count em"),r=this.$(".comment-textarea").val(),n=this.$(".comment-textarea").attr("maxlength");i.hasClass("error")&&i.removeClass("error"),a.utils.isIE9OrEarlier()&&r.length>n&&(r=r.substring(0,n),this.$(".comment-textarea").val(r)),s.text(r.length)},handleSubmit:function(){if(!this.formInputEls.prop("disabled")){var e={name:this.$(".comment-name input").val(),email:this.$(".comment-email input").val(),comment:this.$(".comment-textarea").val()};this.trigger("comment.validate-form",e,this.isLoggedIn)}},handleNewComment:function(i){this.$el.find(".add-comment").removeClass("comments-open"),this.$("label").removeClass("error"),this.$("input, textarea, button").prop("disabled",!0),this.$("input, textarea").val(""),this.$(".char-count em").text("0"),this.$("p.no-activity").remove();var s=this;t.delay(function(){s.$("input, textarea, button").prop("disabled",!1)},1e3);var r=e(".activity-stream li.today").length,n=new l({model:i,assetModel:this.model});this.collection.add(i),0===r?(this.$(".activity-stream").prepend(n.render().$el.addClass("new-comment")).prepend('<li class="date-header today"><em>'+a.translate("Today")+"</em><span><b></b></span></li>"),this.$todayElems=this.$(".activity-stream li[data-created]"),this.startTimeAgo()):(this.$(".activity-stream li.today").after(n.render().$el.addClass("new-comment")),this.$todayElems=this.$("li[data-created]:not(.current)")),t.delay(function(){n.$el.removeClass("new-comment")},1e3)},handleCommentError:function(){this.$(".add-comment .server-error").remove(),this.$(".add-comment").append('<p class="server-error">'+a.translate("We're sorry, we had trouble adding your comment. Please refresh the page and try again.")+"</p>"),this.$(".server-error").slideDown(200)},displayError:function(e){var t=".comment-"+e;this.$("label").removeClass("error error-max"),this.$(t).addClass("error"),this.$(t).find("input").focus()},displayMaxCharError:function(e){var i=this.$(".comment-comment");i.addClass("error-max"),t.defer(function(){i.find("textarea").focus()}),this.$(".char-count em").text(e)},refreshActivityStream:function(e){this.collection.fetchActivityStream(e).then(this.renderActivityStream)},renderActivityStream:function(e){var i=this,s=0,r=this.$(".activity-stream").empty();if(t.each(e,function(e){if(e.length){if(!i.displayRevisions||"filtercomments"==i.activityFilter)return;return void r.append(new c({model:e,assetModel:i.model}).render().$el)}if(e.has("created"))switch(i.injectDateTitles(e.get("created"),e),e.get("type")){case"comment":if("filterversions"==i.activityFilter)break;s++,r.append(new l({model:e,assetModel:i.model}).render().$el);break;case"version":if(!i.displayRevisions||"filtercomments"==i.activityFilter)break;s++,r.append(new m({model:e,assetModel:i.model}).render().$el)}}),0===s)return this.$("ul.activity-stream").append('<p class="no-activity">'+a.translate("There are no comments for this item yet.")+"</p>"),void this.trigger("comments.updated");this.$(".activity-stream li.version").first().addClass("current").find("dt").html("<em>"+a.translate("Current Version")+"</em>"),this.contextMenu&&this.contextMenu.rebindToggle(),this.$todayElems=this.$(".activity-stream li[data-created]");var n=this.$todayElems.length||0;n>0&&this.startTimeAgo(),this.trigger("comments.updated")},injectDateTitles:function(t,i){if(!("filterversions"===this.activityFilter&&"comment"===i.get("type")||"filtercomments"===this.activityFilter&&"version"===i.get("type")||!this.displayRevisions&&"version"===i.get("type"))){var s,r=a.utils.getDateFromObject(t),n=(new Date-(new Date).setHours(0,0,0))/1e3,o=Math.round(((new Date).getTime()-r.getTime())/1e3);if(s=n>o?"today":o>=n&&n+86400>o?"yesterday":Math.round(o/86400),void 0!==s&&s!==this.dateHeader){var l="number"==typeof s?a.utils.formatMonthDateAndYear(r):a.translate("today"===s?"Today":"Yesterday");e("ul.activity-stream").append('<li class="date-header '+("string"==typeof s?s:"")+'"><em>'+l+"</em><span><b></b></span></li>"),this.dateHeader=s}}},startTimeAgo:function(){var e=this,t=0;this.timeAgoTimer=setInterval(function(){t++,e.model.set("_timeMinAgo",t),e.handleTimeAgoUi(t)},6e4)},clearTimerAgo:function(){this.model.set("_timeMinAgo",0),clearInterval(this.timeAgoTimer)},handleTimeAgoUi:function(){var i,s=this,r=this.$("li").hasClass("yesterday"),n=(new Date-(new Date).setHours(0,0,0))/1e3;t.each(this.$todayElems,function(t){var o=e(t),l=+o.attr("data-created"),m=Math.round(((new Date).getTime()-new Date(l).getTime())/1e3);n>m?o.find("b").text(a.utils.dateTimeAgoText(l)):(o.removeAttr("data-created"),s.$todayElems=this.$(".activity-stream li[data-created]"),r?(i=o.detach(),s.$("li.yesterday").after(i)):(o.after('<li class="date-header yesterday">'+a.translate("Yesterday")+"</li>"),i=o.detach(),s.$("li.yesterday").after(i)),this.$("li[data-created]").length<1&&(s.$("li.today").remove(),s.clearTimerAgo()),o.find("b").text(a.utils.dateTimeAgoText(l)))})},disableComments:function(){this.formInputEls.prop("disabled",!0)},enableComments:function(){this.formInputEls.prop("disabled",!1)},startNotifications:function(){this.stopNotifications();var e=this;o.on("resources",function(){e.refreshActivityStream(!0)})},stopNotifications:function(){var e=this;o.off("resources",function(){e.refreshActivityStream(!0)})}})});