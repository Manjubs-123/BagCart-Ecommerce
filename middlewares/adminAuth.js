export const isAdminAuthenticated=(req,res,next)=>{
    if(req.session&&req.session.isAdmin){
        return next();
    }else{
        return res.redirect("/admin")
    }
};