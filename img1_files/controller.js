define(["jquery","underscore","plugin-dependencies","./view","./activity-collection","./comment-model","plugin-components/data-store","common/datastore/collabservice/api/comments/create","common/utils/sharedcloud"],function(e,n,t,o,i,m,a,r){var l,c=t.log("ccweb.files.activity"),s=new o,d=new i,u=t.utils.getPageName(),f="share"===u||-1!==u.indexOf("share"),p=function(e,n){if(""===e.comment)return void s.displayError("comment");if(e.comment&&e.comment.length>1e3)return c("comment-error-max-char"),void s.displayMaxCharError(e.comment.length);if(n)e.name=t.user.get("displayName"),e.email=t.user.get("email");else{if(""===e.name)return void s.displayError("name");var o=e.email.length>0?t.utils.getValidEmails(e.email):[];if(0===o.length)return void s.displayError("email")}v(e)},v=function(e){var n="application/vnd.adobe.asset";return s.disableComments(),r(l.id,n,e.name,e.email,e.comment,null).done(function(n,o,i){var a=i.getResponseHeader("Location"),r=new m;r.set({url:a,_target:l.id,commenter_name:t.utils.htmlEncode(e.name),commenter_email:t.utils.htmlEncode(e.email),content:t.utils.htmlEncode(e.comment),id:a.split("/").pop(),created:(new Date).getTime()}),d.add(r),s.handleNewComment(r),c("add-comment"),c("ets",{code:"CC_COLLABORATION_ACTIVITY",sub_code:"COMMENT"}),c("cca",{code:"Comments",root:{assetid:l.id,assetType:"File",viewType:"1Up"}})}).fail(function(){s.handleCommentError()}).always(function(){s.enableComments()}),!1},g={setResource:function(e){return l=e,s.model=l,s.collection=d,d.assetModel=e,g},show:function(){return s.isLoggedIn="undefined"!=typeof t.auth.token,s.displayRevisions=!f&&l.get("revisions"),s.on("comment.validate-form",p),s.render().$el},remove:function(){return s.off("comment.validate-form",p),s.remove(),g}};return g});