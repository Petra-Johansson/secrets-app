const cookieModel = document.querySelector(".cookie-consent-model ")
const cancelCookieBtn = document.getElementById("cancelBtn")
const acceptCookieBtn = document.getElementById("acceptBtn")



cancelCookieBtn.addEventListener("click", function (){
    console.log("first log")
    cookieModel.classList.remove("active")
})
acceptCookieBtn.addEventListener("click", function (){
    console.log("second log")
    cookieModel.classList.remove("active")
    localStorage.setItem("cookieAccepted", "yes")
})


setTimeout(function (){
    const cookieAccepted = localStorage.getItem("cookieAccepted")
    if (cookieAccepted != "yes"){
        cookieModel.classList.add("active")
    }
}, 2000); 