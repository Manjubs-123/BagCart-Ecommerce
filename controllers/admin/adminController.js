import dotenv from "dotenv";
dotenv.config();

export const renderAdminLogin=(req,res)=>{
    res.render("admin/login",{error:null});
};

export const postAdminLogin=(req,res)=>{
    const{ email,password }=req.body;

    if(email===process.env.ADMIN_EMAIL && password===process.env.ADMIN_PASSWORD){
        req.session.isAdmin=true;
        res.redirect("/admin/dashboard");
    }else{
        res.render("admin/login",{error:"Invalid Credentials"});
    }

};

export const renderAdminDashboard=(req,res)=>{
    res.render("admin/dashboard");
};

export const adminLogout=(req,res)=>{
    req.session.destroy(()=>{
        res.redirect("/admin");
    });
};
